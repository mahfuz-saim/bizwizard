import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const modulePath = process.env.ARTIFACT_TOOL_MODULE;
const { Presentation, PresentationFile } = await import(modulePath ? pathToFileURL(modulePath).href : '@oai/artifact-tool');
const build = path.join(here, '.build');
await fs.mkdir(build, { recursive: true });
const P = Presentation.create({ slideSize: { width: 1600, height: 900 } });
const C = { navy: '#101F3C', ink: '#13243F', blue: '#2463EB', pale: '#E9F0FF', bg: '#F6F8FC', white: '#FFFFFF', muted: '#637089', line: '#D8E0ED', teal: '#14837D', coral: '#B85B4B', gray: '#8B9BB6', light: '#ADBBD2' };
const font = 'Arial';
const timings = [25,30,25,30,35,45,35,45,35,45,35,45,40,35,45,15];
const workflowImages = {
  cash: 'images/photo_6249019189544817640_y.jpg',
  agents: 'images/photo_6249019189544817641_y.jpg',
  matching: 'images/photo_6249019189544817642_y.jpg',
  analysis: 'images/photo_6249019189544817643_y.jpg',
};
const refs = {
  technical: 'submission/technical/main.tex', security: 'submission/security/main.tex',
  benchmark: 'evidence/submission/benchmark-live-results.json', matched: 'evidence/submission/matched-evaluation-live.json',
  logs: 'evidence/submission/sandbox-operation-logs.json', replay: 'evidence/submission/matched-replay-verification.json',
};
const read = async p => JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const benchmark = await read(refs.benchmark);
const matched = await read(refs.matched);
const operations = await read(refs.logs);
const replay = await read(refs.replay);
const roleOrder=['ANALYST_AGENT','TREASURER_AGENT','BORROWER_AGENT','LENDER_AGENT'];
const wins=new Map(roleOrder.map(role=>[role,{ai:0,rules:0,tie:0}]));
for(const row of benchmark.report.cases){
  if(!row.success||row.usedFallback)throw new Error('The live-results slide requires successful live calls without fallback.');
  for(const m of row.comparison.measurements){
    const count=wins.get(m.agent);
    if(!count||!Number.isFinite(m.differenceInFavourOfParticipant))throw new Error('Unrecognized benchmark measurement.');
    count[m.differenceInFavourOfParticipant>0?'ai':m.differenceInFavourOfParticipant<0?'rules':'tie']++;
  }
}
const totals=[...wins.values()].reduce((a,b)=>({ai:a.ai+b.ai,rules:a.rules+b.rules,tie:a.tie+b.tie}),{ai:0,rules:0,tie:0});
const suites=operations.report.operations.filter(o=>o.name!=='apply-migrations');
const suiteCount=(kind)=>suites.reduce((sum,o)=>sum+Number(o.summaries.find(s=>s.startsWith(`# ${kind} `))?.split(' ').at(-1)??0),0);
const passCount=suiteCount('pass');
if(!operations.report.success||suiteCount('fail')||suiteCount('skipped'))throw new Error('Execution evidence no longer matches the stated passing scope.');
const money=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=n=>(n<0?'−':n>0?'+':'')+money(Math.abs(n));
const metricLabels={'LENDER_AGENT':'Lender / net credit return','BORROWER_AGENT':'Borrower / borrowing cost','TREASURER_AGENT':'Treasurer / closing cash','ANALYST_AGENT':'Analyst / modeled margin'};
const pairedRows=matched.report.outcome.scorecards.map(s=>[metricLabels[s.agentType],money(s.baseline),money(s.participant),signed(s.alpha)]);

function text(s, value, x, y, w, h, size=28, opts={}) {
  const t=s.shapes.add({name:opts.name ?? value.replace(/\s+/g,' ').slice(0,60),geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  t.text=value;
  t.text.style={typeface:font,fontSize:size,color:opts.color??C.ink,bold:opts.bold??false,alignment:opts.align??'left',verticalAlignment:'top',insets:0,autoFit:'none',wrap:'square'};
  return t;
}
function rule(s,x,y,w,color=C.line){s.shapes.add({name:'Section rule',geometry:'line',position:{left:x,top:y,width:w,height:0},fill:'none',line:{fill:color,width:1.3}});}
function slide(title,{dark=false}={}) {
  const s=P.slides.add();s.background.fill=dark?C.navy:C.bg;
  s._dark=dark;
  const i=P.slides.items.length;
  text(s,'BizWizard',72,34,220,30,21,{bold:true,color:dark?C.white:C.navy});
  text(s,String(i).padStart(2,'0'),1320,34,208,28,19,{align:'right',color:dark?C.light:C.muted});
  if(title)text(s,title,72,105,1456,142,60,{bold:true,color:dark?C.white:C.ink,name:'Slide heading'});
  return s;
}
function note(s,talk,sources=[],extra='') {
  const n=P.slides.items.indexOf(s)+1;
  s.speakerNotes.text=`Suggested speaking time: ${timings[n-1]} seconds.\n\n${talk}\n\n${extra}\n\nSources\n${sources.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`.trim();
}
function caption(s,t,y=831){text(s,t,72,y,1456,42,19,{color:s._dark?C.light:C.muted});}
async function image(s,file,x,y,w,h,{crop,alt}={}) {
  const bytes=await fs.readFile(path.join(here,'assets',file));
  const config={blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:alt??file,fit:'contain',position:{left:x,top:y,width:w,height:h}};
  if(crop)config.crop=crop;
  return s.images.add(config);
}
function node(s,title,body,x,y,w=280,h=150,{dark=s._dark,accent=false}={}) {
  const box=s.shapes.add({name:title,geometry:'rect',position:{left:x,top:y,width:w,height:h},fill:accent?C.blue:(dark?'#1C3154':C.white),line:{fill:dark?'#415779':C.line,width:1.5}});
  text(s,title,x+22,y+20,w-44,62,26,{bold:true,color:dark||accent?C.white:C.ink});
  if(body)text(s,body,x+22,y+86,w-44,h-92,22,{color:dark||accent?'#DCE6F7':C.muted});
  return box;
}
function connect(s,a,b,{from='right',to='left',color=s._dark?'#7FA5FF':C.blue,dashed=false}={}) {
  return s.shapes.connect(a,b,{kind:from==='right'&&to==='left'?'straight':'elbow',fromSide:from,toSide:to,line:{fill:color,width:2.5,style:dashed?'dashed':'solid'},tail:{type:'triangle',width:'sm',length:'sm'}});
}
function table(s,values,x,y,w,h,widths,size=25){
  const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});
  t.styleOptions={headerRow:true,bandedRows:false};
  t.borders.assign({fill:C.bg,width:0.7,style:'solid'});
  for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
    const cell=t.getCell(r,c);cell.fill=r===0?C.navy:r%2?C.white:'#EDF2F9';
    cell.text.style={typeface:font,fontSize:size,bold:r===0,color:r===0?C.white:C.ink,insets:{left:14,right:14,top:14,bottom:10},verticalAlignment:'middle'};
  }
  return t;
}
function copy(s,title,body,x,y,w,{dark=s._dark,size=28}={}){
  text(s,title,x,y,w,48,32,{bold:true,color:dark?C.white:C.ink});
  text(s,body,x,y+56,w,112,size,{color:dark?C.light:C.muted});
}

// 1. Opening: the product and its purpose.
{
 const s=slide('',{dark:true});
 text(s,'SME FINANCE COPILOT',72,160,650,36,22,{color:'#94B6FF',bold:true});
 text(s,'BizWizard',72,235,690,120,106,{bold:true,color:C.white});
 text(s,'Financial decisions\nfor the shop owner',72,385,670,150,58,{bold:true,color:C.white});
 text(s,'Financing options, cash alerts\nand business analysis in one workspace.',76,570,650,92,29,{color:C.light});
 await image(s,'dashboard-main.png',795,188,733,484,{alt:'BizWizard dashboard rendered in a local illustrative demo'});
 text(s,'Current product UI with illustrative demo data',795,697,730,35,19,{color:C.light});
 text(s,'BongoForge',76,738,670,35,27,{bold:true,color:C.white});
 text(s,'Sadman Sakib  /  Mahfuz Saim  /  Sunan Rabbi',76,779,1450,33,24,{color:C.white});
 text(s,'Rajshahi University of Engineering & Technology (RUET)',76,820,1450,31,23,{color:C.light});
 text(s,'CSE, 4th year, 2nd semester',76,856,1450,28,21,{color:C.light});
 text(s,'2026 FinTechathon International Track',795,752,733,33,21,{color:C.light});
 note(s,'We are BongoForge: Sadman Sakib, Mahfuz Saim and Sunan Rabbi. All three of us study CSE in the fourth year, second semester at Rajshahi University of Engineering & Technology, RUET. BizWizard helps a small-business owner make financing and cash decisions using the records the shop already keeps. We will follow an owner from a cash concern to a proposed action, then show the controls and evidence behind that action.',[refs.technical,'README.md','submission/presentation/assets/provenance.json','Team names and academic affiliation supplied by the team.']);
}

// 2. Problem: cash timing, without invented market statistics.
{
 const s=slide('A busy shop can still run short of cash');
 text(s,'An illustrative owner scenario',76,238,1300,43,27,{color:C.muted});
 const a=node(s,'Stock on the shelf','Cash has already\npaid for inventory',76,352,310,180);
 const b=node(s,'Sales on credit','Customers still\nowe the shop',455,352,310,180);
 const c=node(s,'Bills approaching','Rent and suppliers\nneed payment',834,352,310,180);
 connect(s,a,b);connect(s,b,c);
 text(s,'The owner’s question',1203,352,310,42,25,{color:C.blue,bold:true});
 text(s,'“Can I pay\nand restock?”',1203,410,320,122,39,{bold:true});
 rule(s,76,612,1448);
 text(s,'Sales, stock and cash answer different questions.',76,654,1448,64,39,{bold:true});
 text(s,'The decision needs payment timing, financing terms and product economics together.',76,733,1430,65,28,{color:C.muted});
 note(s,'This is an example of the decision problem, not a measured market statistic. Stock can consume cash before a sale. A credit sale creates revenue before collection. Bills can arrive in between. An owner needs to know whether to collect, reduce spending, change stock or seek financing.',[refs.technical,'PLAN.md'], 'This slide describes an illustrative scenario. It makes no market-size or customer-adoption claim.');
}

// 3. Solution: the three Topic E capabilities.
{
 const s=slide('Three finance questions, one set of records');
 copy(s,'Which financing fits?','Compare eligibility, cost\nand repayment capacity.',76,264,455);
 copy(s,'Will cash run short?','Project dated balances\nand review alerts.',568,264,460);
 copy(s,'Where is cash tied up?','Inspect product margins\nand working capital.',1062,264,465);
 await image(s,'inventory-main.png',76,474,1112,304,{alt:'Inventory screen showing the business records that feed the finance copilot'});
 await image(s,'mobile-cashflow.png',1231,456,272,352,{alt:'Mobile cash-flow screen showing the responsive application'});
 caption(s,'Existing shop records feed the finance workflows. Screens show illustrative demo data.');
 note(s,'These are the three capabilities in Topic E. BizWizard uses sales, inventory, debt and expense records already present in the application. The same shop scope carries into financing, treasury and analysis. The responsive interface supports smaller screens as well.',[refs.technical,'client/src/app/(dashboard)/finance','submission/presentation/assets/provenance.json']);
}

// 4. Workflow: a traceable decision rather than an isolated chat answer.
{
 const s=slide('A decision stays connected to its records',{dark:true});
 const labels=[['Shop records','Sales, debt,\nstock and expenses'],['Finance engines','Cash forecast,\nmetrics and eligibility'],['AI choice','Select or explain\nallowed options'],['Owner review','Approve or reject\na proposed plan'],['Outcome record','Link recorded events\nand inspect results']];
 const nodes=labels.map(([a,b],i)=>node(s,a,b,76+i*296,308,264,190,{accent:i===3}));
 for(let i=0;i<nodes.length-1;i++)connect(s,nodes[i],nodes[i+1]);
 text(s,'Example: overdue customer payment',76,575,1410,48,35,{bold:true,color:C.white});
 text(s,'A cash alert leads to a proposed collection plan. The owner reviews it.\nA recorded payment can later supply evidence of collection.',76,647,1410,106,32,{color:C.light});
 caption(s,'Approval records a decision. The application does not execute a bank transfer.');
 note(s,'Follow a collection decision through the system. The cash engine raises an alert from scoped records. A treasury recommendation comes from a prepared menu and passes financial guards. The owner can approve a plan. Collection evidence must link an existing recorded debt payment. Approval alone cannot claim that cash arrived. Financing acceptance follows a separate application workflow.',[refs.technical,refs.security,'server/src/app/modules/finance/cashflow/cashflow.service.ts']);
}

// 5. Financing: show the actual ranking interface, then the bounded sequence.
{
 const s=slide('Financing that starts with affordability');
 copy(s,'1  Check eligibility','90 days of sales history.\nAt least 60% sales-day coverage.',76,266,490);
 copy(s,'2  Compare feasible options','AI can enrich the ranking.\nCode prices the offer.',76,441,490);
 copy(s,'3  Review the terms','Deterministic policies negotiate\nfor up to three rounds.',76,616,490);
 text(s,'7 simulated lenders   /   12 seeded products',601,269,927,43,29,{bold:true,color:C.blue});
 await image(s,'matching-ranked.png',601,330,927,408,{alt:'Ranked financing options in the current application, using illustrative synthetic responses'});
 caption(s,'Simulated lenders only. Acceptance creates an application and repayment schedule, with no disbursement.');
 note(s,'Matching needs at least 60 percent sales-day completeness across a 90-day window. Deterministic weights are affordability 30 percent, cost 25, liquidity 20, collateral 15 and flexibility 10. AI score changes stay within 15 points before a 60/40 blend. Pricing and negotiation use deterministic policies, not LLM-to-LLM bargaining. Initial offers pass guards. Acceptance checks scope, offer state and expiry but does not re-underwrite current affordability. The displayed APR is an annualized cost approximation. The screenshot illustrates the UI, not a live lender quote.',[refs.technical,'server/src/app/modules/finance/matching/matching.service.ts','server/src/app/modules/finance/agents/agentCore.ts','submission/presentation/assets/provenance.json']);
}

{
 const s=slide('Financing rules and negotiation');
 text(s,'Ten eligibility rules run before AI sees the eligible products.',76,238,1448,48,32,{bold:true});
 table(s,[['Affordability','Cost','Liquidity','Collateral','Flexibility'],['30%','25%','20%','15%','10%']],76,319,1448,150,[310,250,290,300,298],28);
 text(s,'Final score = 60% rules + 40% AI',76,508,850,48,38,{bold:true,color:C.blue});
 text(s,'The AI score stays within ±15 points of the rules score.',76,568,1440,43,29,{color:C.muted});
 copy(s,'Repayment capacity','Monthly installment ≤50% of free cash flow.\nSecured principal also respects 85% of collateral.',76,650,720,{size:27});
 copy(s,'Negotiation limits','Up to 3 rounds. Borrower acceptance tests\na 35% installment burden and owner rate limits.',858,650,670,{size:27});
 caption(s,'Code prices offers from risk and product limits. A guard breach produces no offer.');
 note(s,'A 90-day profile combines sales, lot-level cost of goods sold, operating expenses, debts, inventory and existing installments. It includes margin, days sales outstanding, debt/revenue, monthly free cash flow and sales-day coverage. The seeded catalog contains seven simulated providers and twelve products. Ten eligibility rules check minimum/maximum amount, minimum/maximum tenor, business age, revenue, debt/revenue, sector, GSTIN and bank statements. All passing rules give ELIGIBLE. Exactly one soft miss within 20% gives NEAR_MISS. Other failures give INELIGIBLE. Below 60% sales-day completeness, matching stops. Only eligible products enter AI reranking. Weighted rules scores use affordability 30%, cost 25%, liquidity 20%, collateral 15% and flexibility 10%. Clamp the AI score to ±15 points of the deterministic score, within 0–100, then blend 60% deterministic and 40% AI.\n\nAffordability converts 50% of monthly free cash flow into a serviceable principal using rate and tenor. A positive finite collateral limit can further cap principal at 85% of collateral value. These are distinct units, not a comparison of monthly cash flow directly with principal. Borrower acceptance uses a 35% installment/free-cash-flow test, APR versus gross margin and owner rate preferences. Lender pricing estimates probability of default and loss given default, applies a heuristic risk premium and clamps the rate to the product band. The guard checks positive amount, affordability, rate, tenor and advance rate. The 85% advance-rate guard can reject unsecured offers whose core proposes 100%; therefore an eligible match need not become an offer. A decline is a valid recorded result.\n\nNegotiation runs deterministic lender/borrower policies for at most three rounds. Each stored step includes party, proposed amount/rate/tenor, decision, message and reasoning. The owner sees score bars, failed rules and trade-offs, then full-term cost, thread and schedule. Records include financing_matches, financing_offers with APR/conditions/expiry, financing_negotiations, loan_schedules and ai_decisions including ISSUE_OFFER or DECLINE_OFFER. Acceptance creates an application and installment schedule, never a disbursement. It checks scope, state and expiry but does not re-underwrite current affordability. APR is an annualized cost approximation, not regulatory IRR APR.',[workflowImages.matching,'server/src/app/modules/finance/shared/eligibility.ts','server/src/app/modules/finance/shared/affordability.ts','server/src/app/modules/finance/shared/guard.ts','server/src/app/modules/finance/agents/agentCore.ts','server/src/app/modules/finance/matching/matching.service.ts']);
}

// 6. Cash: screenshot carries the dated balance and the alert.
{
 const s=slide('Cash flow before the next bill');
 await image(s,'cashflow-main.png',76,253,1010,531,{alt:'Cash forecast and buffer alert in a local illustrative demo'});
 copy(s,'90-day projection','History, dated commitments\nand weighted receivables.',1131,272,393);
 copy(s,'Nine alert conditions','Shortfalls, cash buffers,\naging debt and unusual costs.',1131,462,393);
 copy(s,'A reviewable next step','The owner can inspect a plan\nbefore approving it.',1131,652,393,{size:26});
 caption(s,'Illustrative demo data. Projected cash and proposed actions are forecasts, not realized gains.');
 note(s,'The projection uses recent inflow and outflow levels, weekday patterns and a clipped trend. Dated commitments and probability-weighted receivables change future balances. Nine conditions span eight alert families, with separate 30-day and 60-day debt-aging conditions. Non-simulated sales, debt payments and expenses synchronize through PostgreSQL triggers. Demo shops use an isolated simulator ledger. The demo screenshot shows a low cash buffer and a collection recommendation.',[refs.technical,'server/src/app/modules/finance/shared/cashEngine.ts','server/src/app/modules/finance/shared/alerts.ts','submission/presentation/assets/provenance.json']);
}

{
 const s=slide('Cash forecast and action rules');
 table(s,[['History','Forecast','Alert conditions'],['180 days','90 days','9']],76,249,1448,147,[484,482,482],32);
 copy(s,'Daily balance calculation','Weekday patterns and a trend clipped to ±30%.\nDated bills and weighted receivables change cash.',76,458,1440,{size:30});
 copy(s,'Collection assumptions','70% weight for receivables aged 0–7 days.\n12% for balances aged 61 days or more.',76,618,735,{size:28});
 copy(s,'Cash buffer','Cash ÷ average daily outflow\nfrom the last 28 days.',890,618,638,{size:28});
 text(s,'Guarded proposals. Critical alerts notify the owner. A daily 06:00 server-time job repeats the run.',76,787,1448,31,23,{color:C.blue});
 caption(s,'The owner reviews a proposed action. A linked payment record supplies collection evidence.');
 note(s,'Input: 180 days of shop-scoped cash-ledger history, dated commitments and open receivables. PostgreSQL triggers synchronize non-simulated sales, debt payments and expenses atomically with the cash ledger. Simulation shops maintain a separate ledger. TypeScript computes the money values. The projection combines day-of-week factors, a recent 28-day level and a trend clipped to ±30% of level. Receivables use age-bucket collection weights, from 70% at 0–7 days to 12% at 61+ days, with estimated collection dates. Buffer days equal current cash divided by average daily outflow over up to 28 history days. The forecast saves 90 daily buckets, closing cash, trough date, first shortfall date and amount. These are modeled assumptions, not promised collection rates.\n\nNine conditions cover projected shortfall, buffer, debt aging, idle cash and decline/cost signals. Debt-aging conditions are separate. Alerts persist as OPEN with severity and metric snapshots. CRITICAL alerts create an owner-scoped notification in the same shop and tenant. The deterministic treasury path builds a menu, ranks positive-impact actions and checks mandate exposure and projected balances. Guard violations record REJECTED_BY_GUARD and do not create proposed actions. The current run passes a zero balance floor to the final treasury guard; the menu uses the target buffer. Do not claim that this call enforces a 14-day target floor on every proposal. The owner sees the balance curve, buffer versus the configured target (default 14 days), trough date, next action, estimated impact and manual completion step. A shortfall inside fourteen days allows earlier planning, without guaranteeing a business outcome.\n\nApproval records intent and moves no money. Collection evidence links a unique existing debt payment, not an arbitrary gain. Database records include cash_flow_projections, cash_alerts with rule and metricSnapshot, treasury_action_evidence and ai_decisions with guardResult/status. A daily 06:00 server-time cron repeats treasury work and reconciles EXECUTED actions older than seven days only when linked evidence exists. A linked collection can also reconcile immediately through the service. The routine treasury choice is currently deterministic-core, while optional AI policy selection exists in the matched sandbox evaluation.',[workflowImages.cash,'server/src/app/modules/finance/shared/cashEngine.ts','server/src/app/modules/finance/shared/alerts.ts','server/src/app/modules/finance/cashflow/cashflow.service.ts','server/src/app/modules/finance/cron/financeCron.service.ts','server/src/app.ts']);
}

// 7. Analysis: evidence before recommendation.
{
 const s=slide('An explanation has to match the numbers');
 await image(s,'analysis-main.png',76,250,960,548,{alt:'Financial analysis with a verified margin insight and product economics, using illustrative demo data'});
 text(s,'Candidate explanation',1094,280,430,45,31,{bold:true});
 text(s,'Check the contribution\nto the observed gap',1094,351,430,105,32,{color:C.blue,bold:true});
 text(s,'Residual gap ≤10%',1094,500,430,48,35,{bold:true});
 text(s,'Accounting attribution\nsupports the “verified” label.',1094,569,430,90,28,{color:C.muted});
 text(s,'Scenarios explore changes\nbefore the owner commits.',1094,702,430,90,27,{color:C.muted});
 caption(s,'Illustrative demo data. Verification checks accounting consistency, not causation.');
 note(s,'The analyst can propose a candidate explanation. Code checks how much of a nonzero gap the candidate accounts for. A residual of at most ten percent allows the verified label. This is accounting attribution, not proof that changing the product caused profit to rise. Product economics and working-capital measures give context. Price, collection, cost and mix scenarios use simplified models. Observed capital outcomes compare 30-day windows and remain non-causal.',[refs.technical,'server/src/app/modules/finance/shared/verifier.ts','server/src/app/modules/finance/analysis/analysis.service.ts','submission/presentation/assets/provenance.json']);
}

{
 const s=slide('Analysis checks and outcome measurement');
 table(s,[['Metric history','Forecast / anomaly history','Forecast holdout'],['90 days','120 days','14 days']],76,248,1448,145,[440,600,408],28);
 copy(s,'Unusual changes','Weekday-adjusted robust z-score: |z| >3.5.\nAI ranks the supplied candidate explanations.',76,451,780,{size:29});
 copy(s,'Verification threshold','Residual gap ≤10%.\nKeep refuted explanations in the record.',908,451,620,{size:29});
 copy(s,'Stock and customer risk','Dead stock: >45 days without sale and >5%\nof stock value. Top customer >25% or HHI >0.25.',76,654,780,{size:27});
 copy(s,'Capital decisions','Freeze a baseline, then observe 30 days.\nBefore/after results remain non-causal.',908,654,620,{size:27});
 caption(s,'Missing lot costs use a 70% sales-value estimate. Forecast accuracy reports held-out MAPE when available.');
 note(s,'Input: sales, lot-level cost of goods sold, expenses, receivables, inventory and customer mix. Metrics use a 90-day profile; forecasting and anomaly detection load 120 days of daily sales. The reference image describes thirty metrics. The implementation returns families of profit/loss, product unit economics, working capital, breakeven/profitability, customer concentration and risk, plus metadata rather than a fixed thirty-row report. Working-capital cash conversion cycle equals days sales outstanding + days inventory outstanding − days payable outstanding. Product economics include margins, stock value and ABC-style quadrants. Missing or unavailable lot buy prices fall back to an estimated 70% of discounted line value. The source does not guarantee a separate per-line warning for every estimated cost, so do not present all costs as observed.\n\nForecasting holds out the last fourteen days when sufficient history exists, predicts those dates and reports actual MAPE. Unavailable validation remains unavailable rather than invented accuracy. A day-of-week-adjusted median-absolute-deviation z-score flags absolute z >3.5. AI only ranks candidate IDs supplied by code. For anomaly hypotheses, the verifier subtracts a candidate contribution from the nonzero original gap; residual within 10% allows VERIFIED. This is accounting attribution, not a causal experiment. Deterministic stock/margin/risk detectors also create verified facts directly. The default insight feed filters to VERIFIED; REFUTED entries remain accessible in stored records and unfiltered queries.\n\nDead stock requires more than 45 days since last sale and over 5% of total inventory value. Concentration triggers at top-customer share over 25% or HHI over 0.25. Scenarios vary price, collections, costs or mix and rank modeled expected value. Capital approval freezes a baseline before the thirty-day observation window. Owner outputs include the hypothesis, evidence, product quadrants, headline report, forecast and ranked scenarios. Evidence includes insights.verificationStatus and residual metrics, forecasts.method/backtest MAPE, and capital_decisions with frozen baseline/measurement. Thirty-day before/after observations do not prove causal profit or AI alpha.',[workflowImages.analysis,'server/src/app/modules/finance/analysis/analysis.service.ts','server/src/app/modules/finance/shared/metricEngine.ts','server/src/app/modules/finance/shared/verifier.ts','server/src/app/modules/finance/shared/scenario.ts','server/src/app/modules/finance/shared/shopData.ts']);
}

// 8. Architecture: editable native diagram, with clear trust boundaries.
{
 const s=slide('System architecture');
 const browser=node(s,'Next.js frontend','React / Tailwind\nVercel deployment',76,285,380,145);
 const api=node(s,'Express API','JWT, roles and scope\nRequest validation',610,285,380,145,{accent:true});
 const db=node(s,'PostgreSQL','Prisma migrations\nScoped business records',1144,285,380,145);
 const engines=node(s,'Finance engines','Calculations, forecasts\nand financial guards',76,563,380,145);
 const runtime=node(s,'AI runtime','Structured JSON\nBudget and fallback',610,563,380,145);
 const provider=node(s,'Optional OpenAI','Select or explain\nconstrained options',1144,563,380,145);
 connect(s,browser,api);connect(s,api,db);connect(s,engines,runtime);connect(s,runtime,provider);
 // Straight segments preserve the route when Google Slides imports the PPTX.
 for(const [x,y,w,h,arrow] of [[800,430,0,80,false],[266,510,534,0,false],[266,510,0,53,true]]){
  s.shapes.add({name:'API to finance engines',geometry:'connector',kind:'straight',position:{left:x,top:y,width:w,height:h},line:{fill:C.blue,width:2.5},...(arrow?{tail:{type:'triangle',width:'sm',length:'sm'}}:{})});
 }
 text(s,'Same-origin API proxy',77,454,450,38,22,{color:C.muted});
 text(s,'Backend authorization',1090,454,434,38,22,{color:C.blue});
 caption(s,'Browser, application, database and external AI form separate trust boundaries.');
 note(s,'The browser uses a same-origin Next.js API rewrite. Express verifies the token, explicit role, tenant membership and employee shop assignment, then validates requests. Services use PostgreSQL through Prisma. The finance engines calculate money and constraints in TypeScript. The optional provider receives minimized structured inputs through a shared runtime. Upload and push providers exist outside this finance diagram. One production database serves the app; the local disposable test database is evidence infrastructure.',[refs.technical,refs.security,'client/next.config.ts','server/src/app.ts','server/src/app/middlewares/verifyTenant.ts']);
}

// 9. AI roles and deterministic boundaries, with one compact process diagram.
{
 const s=slide('Where AI participates',{dark:true});
 text(s,'Four agent roles',76,266,700,49,38,{bold:true,color:C.white});
 text(s,'Lender, borrower, treasurer and analyst.\nOptional AI supports ranking, explanations\nand matched evaluation choices.',76,339,701,120,29,{color:C.light});
 text(s,'Code keeps the financial contract',855,266,673,49,38,{bold:true,color:C.white});
 text(s,'Eligibility, pricing, negotiation policies,\nrepayment math and outcome calculations.',855,339,673,120,31,{color:C.light});
 text(s,'$2 / tenant / month default budget     6s fast / 12s reasoning deadline',76,477,1448,43,29,{color:'#94B6FF',bold:true});
 const a=node(s,'Scoped inputs','Only the relevant shop',76,556,266,146);
 const b=node(s,'JSON choice','Schema and allowed IDs',383,556,266,146);
 const c=node(s,'Guards','Independent code checks',690,556,266,146);
 const d=node(s,'Decision or fallback','Label the model used',997,556,431,146,{accent:true});
 connect(s,a,b);connect(s,b,c);connect(s,c,d);
 caption(s,'No key: zero provider calls. A fallback after an invalid response or timeout can still incur cost.');
 note(s,'Four roles: lender, borrower, treasurer and analyst. Code supplies precomputed options and shop aggregates. One active mandate per shop/role controls objectives and limits. Editing inserts version +1 and deactivates the previous version. Routine pricing, negotiation and treasury picks use deterministic policies. Optional model calls enrich eligible ranking, generate constrained hypotheses, or select policies for the matched evaluation. Do not present all agent activity as a paid AI call.\n\nFor configured provider calls: check enablement, redact structured inputs, reserve a conservative estimated budget, request JSON-only output and validate with Zod plus allowed IDs. The default deadlines are six seconds for fast and twelve seconds for reasoning, shared with at most one repair retry. Redaction targets identifying keys and selected email/phone strings but is incomplete. A PostgreSQL advisory transaction lock serializes reservations per tenant and calendar month. The configurable default monthly budget is USD 2 per tenant. Financial guards run after generation. A violation voids the output and records the guard rejection. Owner/admin approval gates consequential actions, and no external bank transfer occurs.\n\nNo API key means zero provider calls and a labeled deterministic path. Budget denial also skips the provider request. Invalid output or a timeout can fall back after an attempted call and can still incur cost. Provider billing is authoritative. Runs record model/prompt version, tokens, estimated cost, latency, status and retries. Decisions record input hashes, output, guard result and status. Persistence is best-effort in some paths, so this is traceability rather than an independently witnessed immutable audit ledger. Evidence tables include ai_runs, ai_decisions, ai_budget_months and finance_evaluations. The owner sees versioned mandates, guard badges, budget, scorecards and audit export. Unknown alpha remains null without matched evidence. Audit JSON exports policies, decisions, runs, performance and evaluation summaries; individual evaluation exports carry replay inputs and outcomes.',[workflowImages.agents,refs.technical,refs.security,'server/src/lib/ai/client.ts','server/src/lib/ai/budget.ts','server/src/app/modules/finance/agents/agents.service.ts','server/src/app/modules/finance/agents/agentCore.ts']);
}

{
 const s=slide('Decision ledger and matched evaluation');
 text(s,'Versioned mandates and recorded choices keep decisions inspectable.',76,245,1448,45,31,{bold:true});
 text(s,'Saved live policy run: eight paired paths on one frozen shop snapshot',76,307,1448,42,28,{color:C.muted});
 table(s,[['Role / metric','Rules baseline (BDT)','AI policy (BDT)','AI-favouring delta'],...pairedRows],76,382,1448,333,[490,320,320,318],25);
 text(s,'Same inputs and outcome draws. Offline replay matched the saved outcome hash.',76,754,1430,40,27,{color:C.muted});
 caption(s,'Loan roles use full terms. Cash and margin use 30 days. These outcomes are simulated and cannot be added as profit.');
 note(s,'The saved shop-specific evaluation is separate from the standalone three-risk benchmark on the evidence slide. Its successful gpt-4o-mini call used no fallback and estimated USD 0.000155. Before the call, the service freezes shop inputs, mandate versions and the available policy universe; it persists choices before outcome replay. Eight paired outcome paths share the same draws. The displayed means come directly from the saved scorecards, with no new paid call during presentation generation. Borrower benefit is baseline cost minus participant cost. Other roles use participant minus baseline. Treasurer and analyst cover thirty days; lender and borrower use full loan terms with independent assumptions. Never combine these metrics into one return.\n\nWithout matched counterfactual evidence, alpha remains null. Saved zero or negative differences stay visible. Mandates retain versions, decisions retain input hashes and guard results, and audit JSON exports policies, decisions, runs and evaluations. Download an individual evaluation to replay its frozen inputs, policy choices, seed, assumptions and both ledgers. From server/, after dependency installation, run npm run evidence:finance -- --replay FILE.json. Replay needs no database and no API key. It recomputes outcomes and checks a canonical hash. A matching hash supports reproducibility, not cryptographic authorship or real-world causality. Refuted explanations and unknown results are retained rather than converted into success claims.',[workflowImages.agents,refs.matched,refs.replay,'server/src/app/modules/finance/agents/matchedEvaluation.service.ts','server/src/app/modules/finance/agents/agents.service.ts','server/scripts/evidence-scenarios.ts']);
}

// 10. Permissions and realistic security scope.
{
 const s=slide('The owner keeps approval authority');
 table(s,[['Finance capability','Employee','Owner / admin'],['Read assigned-shop finance','Allowed','Allowed'],['Acknowledge or dismiss alerts','Allowed','Allowed'],['Change mandates and run agents','Denied','Allowed'],['Accept offers or approve plans','Denied','Allowed']],76,269,950,385,[516,190,244],25);
 copy(s,'Backend checks','Token, role, tenant membership\nand employee shop assignment.',1090,280,438);
 copy(s,'Financial safeguards','Scoped references, allowed IDs\nand transactional state changes.',1090,469,438);
 text(s,'Remaining risks',76,705,1448,41,31,{bold:true});
 text(s,'Browser token storage, incomplete redaction, audit gaps and unverified restore capability need further work.',76,764,1435,69,27,{color:C.muted});
 note(s,'This table summarizes finance routes. Owners operate within their tenant. Admins are trusted and can bypass tenant membership checks. Employees can read assigned-shop finance, including sensitive exports, and acknowledge alerts. Owner/admin roles control finance mutations. Public users have no finance access. Approval does not initiate a real bank transfer. We have not performed an independent penetration test or a restore drill. Browser localStorage tokens, incomplete redaction, mutable best-effort logs and recovery verification remain in the risk register.',[refs.security,'server/src/app/modules/finance/matching/matching.routes.ts','server/src/app/modules/finance/cashflow/cashflow.routes.ts','server/src/app/middlewares/verifyFinanceShopAccess.ts']);
}

// 11. Evidence: native chart of recorded live comparisons and separate integration result.
{
 const s=slide('What the evidence shows');
 text(s,'Live AI versus pinned rules',76,245,1040,47,36,{bold:true});
 text(s,'Three synthetic risk cases across four roles',76,303,1030,39,26,{color:C.muted});
 const chart=s.charts.add('bar',{
  name:'AI and rules comparison counts',position:{left:65,top:364,width:955,height:390},
  categories:['Analyst','Treasurer','Borrower','Lender'],
  series:[['AI wins','ai',C.blue],['Rules wins','rules',C.gray],['Ties','tie','#B9D8E8']].map(([name,key,fill])=>({name,values:roleOrder.map(r=>wins.get(r)[key]),fill,dataLabels:{showValue:true,position:'center',numberFormatCode:'0',textStyle:{fontSize:27,bold:true,fill:key==='tie'?C.ink:C.white}},dataLabelOverrides:roleOrder.flatMap((r,idx)=>wins.get(r)[key]===0?[{idx,showValue:false}]:[])})),
  barOptions:{direction:'bar',grouping:'stacked',gapWidth:70,overlap:100},hasLegend:true,legend:{position:'bottom',textStyle:{fontSize:24,fill:C.ink}},
  chartFill:C.bg,plotAreaFill:C.bg,chartLine:{fill:'none',width:0},plotAreaLine:{fill:'none',width:0},
  xAxis:{visible:true,line:{fill:'none',width:0},majorGridlines:null,textStyle:{fontSize:26,fill:C.ink}},
  yAxis:{visible:false,min:0,max:3,majorUnit:1,numberFormatCode:'0',textStyle:{fontSize:25,fill:C.ink},line:{fill:'none',width:0},majorGridlines:null},
  dataLabels:{showValue:true,position:'center',numberFormatCode:'0',textStyle:{fontSize:27,bold:true,fill:C.white}},
 });
 for(const st of [chart.legend.textStyle,chart.dataLabels.textStyle,chart.xAxis.textStyle,chart.yAxis.textStyle])st.typeface=font;
 for(let i=0;i<3;i++)chart.series.getItemAt(i).dataLabels.textStyle.typeface=font;
 rule(s,1086,250,1);
 text(s,String(passCount),1150,255,370,128,116,{bold:true,color:C.blue});
 text(s,'integration tests passed',1153,394,365,90,34,{bold:true});
 text(s,`${suites.length} suites\nZero failed or skipped\nMigrations applied`,1153,516,365,128,28,{color:C.muted});
 text(s,'Cash integrity, permissions,\nconcurrency and isolation',1153,686,365,83,25,{color:C.muted});
 caption(s,`${totals.ai} AI wins, ${totals.rules} rules wins, ${totals.tie} ties. Synthetic outcomes do not establish real-world financial improvement.`);
 note(s,'The standalone live benchmark made three successful gpt-4o-mini calls without fallback at synthetic default-risk inputs of 5, 20 and 50 percent. Across four roles that gives 12 comparisons: four AI wins, five rules wins and three ties. Borrower modeled cost improved in all three cases. The analyst lost in all three, the treasurer tied, and lender results depended on risk. These are different financial metrics and cannot be summed as profit. Separately, the saved PostgreSQL execution report records 11 passing tests across five suites and successful migrations. These are saved reports, not new tests or paid calls during the presentation build. The preceding slide covers the independent paired shop-specific result.\n\nReviewer commands run from server/ after npm ci. npm run benchmark:finance uses deterministic synthetic fixtures and needs no database or API key. npm run benchmark:finance -- --live needs the reviewer’s own API key and network, with a configured spend limit. npm run evidence:finance applies migrations and runs integration suites against EVIDENCE_DATABASE_URL pointing to disposable local PostgreSQL at 127.0.0.1/simulator_test; it needs no AI key. npm run evidence:finance -- --replay FILE.json checks an exported evaluation offline without PostgreSQL or an API key. Keep live keys in the environment or ignored .env.benchmark. Reports record tested revision, inputs and outcomes. Private source repositories require reviewer access.',[refs.benchmark,refs.logs,refs.technical,'README.md','server/scripts/benchmark-finance.ts','server/scripts/evidence-scenarios.ts'], 'Benchmark total estimated API cost: USD 0.000273. Scope: standalone synthetic policy benchmark, not the entire application negotiation pipeline.');
}

// 12. Closing and handoff to the focused demonstration.
{
 const s=slide('BizWizard in practice',{dark:true});
 text(s,'Business records become\na decision the owner can inspect.',76,268,1435,175,66,{bold:true,color:C.white});
 text(s,'Compare financing. Review a cash alert.\nInspect the evidence behind a recommendation.',76,522,1390,126,39,{color:C.light});
 const link=text(s,'bizwizard-lake.vercel.app',76,730,1100,59,42,{color:'#93B5FF',bold:true});
 link.text.get('bizwizard-lake.vercel.app').link={uri:'https://bizwizard-lake.vercel.app/',isExternal:true};
 caption(s,'Working sandbox. No external lender contact or bank transfer.');
 note(s,'Close with the same owner decision introduced at the start: review the cash outlook, compare feasible financing and inspect the evidence behind a recommendation. If moving to a demonstration, use a synthetic account or isolated demo workspace and the saved evidence. Avoid a new paid call during the talk. Included screenshots support an offline explanation. Current scope is simulated financing with no external lender contact or money execution. Before sensitive production use, strengthen browser-session handling, provider-data controls and audit guarantees, and verify backup restoration. Before real lending, revalidate final affordability and terms, assess legal obligations and implement external execution controls. Heuristic risk/cost models, Float money, trusted administrators and non-causal observations remain limitations.',[refs.technical,refs.security,'README.md','https://bizwizard-lake.vercel.app/']);
}

if(P.slides.items.length!==timings.length)throw new Error('Slide count and speaking times disagree.');
const manifest={mainSlides:P.slides.items.length,backupSlides:0,mainSpeakingSeconds:timings.reduce((a,b)=>a+b,0),font,slideSize:{width:1600,height:900},workflowImages,evidence:[refs.benchmark,refs.matched,refs.logs,refs.replay],screenshots:'Illustrative local demo data. See assets/provenance.json.',sourcesInSpeakerNotes:true};
await fs.writeFile(path.join(build,'manifest.json'),JSON.stringify(manifest,null,2));
for(let i=0;i<P.slides.items.length;i++){
 const s=P.slides.items[i];
 const stem=`slide-${String(i+1).padStart(2,'0')}`;
 const png=await P.export({slide:s,format:'png',scale:1});
 await fs.writeFile(path.join(build,stem+'.png'),new Uint8Array(await png.arrayBuffer()));
 const layout=await s.export({format:'layout'});await fs.writeFile(path.join(build,stem+'.layout.json'),await layout.text());
 console.log(`Rendered ${stem}`);
}
const candidate=path.join(build,'candidate.pptx');
await(await PresentationFile.exportPptx(P)).save(candidate);
console.log(`Exported editable draft: ${candidate}`);
if(process.env.PRESENTATION_SKILL_DIR){
 const skill=process.env.PRESENTATION_SKILL_DIR;
 const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
 const final=process.env.PRESENTATION_OUTPUT ?? path.join(root,'output/presentation/BizWizard-Presentation.pptx');
 await fs.mkdir(path.dirname(final),{recursive:true});
 await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','15240000,8572500','--validate-heading-fit',...[6,8,10,13,14].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:16,requiredNativeTableOwnerSlides:[6,8,10,13,14],requiredNativeChartOwnerSlides:[15],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(build,path.basename(final)+'.validation.json')});
 console.log(`Finalized: ${final}`);
}else{
 console.log('Draft exported. Set PRESENTATION_SKILL_DIR and the runtime paths to run the finalizer.');
}
