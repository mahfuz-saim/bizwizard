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
const timings = [20,35,35,35,45,45,45,40,40,40,45,15];
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
function slide(title,{dark=false,backup=false}={}) {
  const s=P.slides.add();s.background.fill=dark?C.navy:C.bg;s.hidden=backup;
  s._dark=dark;s._backup=backup;
  const i=P.slides.items.length;
  text(s,'BizWizard',72,34,220,30,21,{bold:true,color:dark?C.white:C.navy});
  text(s,backup?'Technical backup':String(i).padStart(2,'0'),1320,34,208,28,19,{align:'right',color:dark?C.light:C.muted});
  if(title)text(s,title,72,105,1456,142,60,{bold:true,color:dark?C.white:C.ink,name:'Slide heading'});
  return s;
}
function note(s,talk,sources=[],extra='') {
  const n=P.slides.items.indexOf(s)+1;
  s.speakerNotes.text=`${n<=12?`Suggested speaking time: ${timings[n-1]} seconds.\n\n`:''}${talk}\n\n${extra}\n\nSources\n${sources.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')}`.trim();
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
 text(s,'2026 FinTechathon International Track',76,821,1000,32,22,{color:C.light});
 note(s,'BizWizard helps a small-business owner make financing and cash decisions using the records the shop already keeps. We will follow an owner from a cash concern to a proposed action, then show the controls and evidence behind that action.',[refs.technical,'README.md','submission/presentation/assets/provenance.json']);
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
 copy(s,'1  Check eligibility','Rules screen amount, tenor\nand business requirements.',76,266,490);
 copy(s,'2  Compare feasible options','AI can enrich the ranking.\nCode prices the offer.',76,441,490);
 copy(s,'3  Review the terms','Deterministic policies negotiate\nfor up to three rounds.',76,616,490);
 await image(s,'matching-ranked.png',601,268,927,476,{alt:'Ranked financing options in the current application, using illustrative synthetic responses'});
 caption(s,'Simulated lenders only. Acceptance creates an application and repayment schedule, with no disbursement.');
 note(s,'Matching needs at least 60 percent sales-day completeness across a 90-day window. Deterministic weights are affordability 30 percent, cost 25, liquidity 20, collateral 15 and flexibility 10. AI score changes stay within 15 points before a 60/40 blend. Pricing and negotiation use deterministic policies, not LLM-to-LLM bargaining. Initial offers pass guards. Acceptance checks scope, offer state and expiry but does not re-underwrite current affordability. The displayed APR is an annualized cost approximation. The screenshot illustrates the UI, not a live lender quote.',[refs.technical,'server/src/app/modules/finance/matching/matching.service.ts','server/src/app/modules/finance/shared/agentCore.ts','submission/presentation/assets/provenance.json']);
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
 text(s,'AI can select and explain',76,266,700,49,38,{bold:true,color:C.white});
 text(s,'Product ranking, treasury choices,\nanalysis hypotheses and evaluation policies.',76,339,701,120,31,{color:C.light});
 text(s,'Code keeps the financial contract',855,266,673,49,38,{bold:true,color:C.white});
 text(s,'Eligibility, pricing, negotiation policies,\nrepayment math and outcome calculations.',855,339,673,120,31,{color:C.light});
 const a=node(s,'Scoped inputs','Only the relevant shop',76,556,266,146);
 const b=node(s,'JSON choice','Schema and allowed IDs',383,556,266,146);
 const c=node(s,'Guards','Independent code checks',690,556,266,146);
 const d=node(s,'Decision or fallback','Label the model used',997,556,431,146,{accent:true});
 connect(s,a,b);connect(s,b,c);connect(s,c,d);
 caption(s,'Missing keys, invalid responses, timeouts and budget denial use a labelled deterministic fallback.');
 note(s,'The AI role varies by workflow. It can enrich eligible product ranking, select a treasury option or suggest a hypothesis. The live matched evaluation also asks for constrained policy choices. Pricing and lender/borrower negotiation are deterministic agent policies. Structured output uses Zod, allowed identifiers and independent financial checks. The runtime allows one repair retry within a deadline. A per-tenant monthly reservation gate limits estimated spend. Usage and some decision logs are best-effort, so logging gaps remain a known risk.',[refs.technical,refs.security,'server/src/lib/ai/client.ts','server/src/lib/ai/budget.ts','server/src/app/modules/finance/shared/agentCore.ts']);
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
 note(s,'The standalone live benchmark made three successful gpt-4o-mini calls without fallback at synthetic default-risk inputs of 5, 20 and 50 percent. Across four roles that gives 12 comparisons: four AI wins, five rules wins and three ties. Borrower modeled cost improved in all three cases. The analyst lost in all three, the treasurer tied, and lender results depended on risk. These are different financial metrics and cannot be summed as profit. Separately, the saved PostgreSQL execution report records 11 passing tests across five suites and successful migrations. We retain these as saved evidence, not as tests rerun during this presentation build. Technical backup provides paired shop-specific results.',[refs.benchmark,refs.logs,refs.technical], 'Benchmark total estimated API cost: USD 0.000273. Scope: standalone synthetic policy benchmark, not the entire application negotiation pipeline.');
}

// 12. Closing and handoff to the focused demonstration.
{
 const s=slide('BizWizard in practice',{dark:true});
 text(s,'Business records become\na decision the owner can inspect.',76,268,1435,175,66,{bold:true,color:C.white});
 text(s,'Compare financing. Review a cash alert.\nInspect the evidence behind a recommendation.',76,522,1390,126,39,{color:C.light});
 const link=text(s,'bizwizard.sadman.app',76,730,1100,59,42,{color:'#93B5FF',bold:true});
 link.text.get('bizwizard.sadman.app').link={uri:'https://bizwizard.sadman.app/',isExternal:true};
 caption(s,'Working sandbox. No external lender contact or bank transfer.');
 note(s,'Close the prepared presentation and move to the demonstration. In a synthetic account or dedicated demo workspace, open Cash Flow, inspect a dated alert, then show a financing option and its explanation. Finish in AI Agent Ledger with the matched evaluation and downloadable evidence. Avoid running a paid call during the talk. If network access fails, use the included screenshots and backup evidence slides. Current limitations remain explicit: sandbox financing, no external money execution and no demonstrated real-world alpha.',[refs.technical,'README.md','https://bizwizard.sadman.app/']);
}

// 13. Hidden backup: the shop-specific matched evaluation, separate from the headline benchmark.
{
 const s=slide('A separate matched sandbox evaluation',{backup:true});
 text(s,'Eight paired paths on one frozen shop snapshot',76,253,1400,47,32,{color:C.muted});
 table(s,[['Role / metric','Rules baseline (BDT)','AI policy (BDT)','AI-favouring delta'],...pairedRows],76,342,1448,359,[490,320,320,318],25);
 text(s,'Lender and borrower use full loan terms. Treasurer and analyst use 30 days.',76,742,1430,41,27,{color:C.muted});
 caption(s,'Same draws for both policies. Offline replay matched the outcome hash. These metrics must remain separate.');
 note(s,'This is the separate shop-specific live policy run, not another summary of the three risk cases. The saved report used gpt-4o-mini without fallback and estimated USD 0.000155 in API cost. Inputs and mandate versions froze before outcome replay. Eight common-draw paths yield the displayed means. Borrower improvements are cost reductions, so the AI-favouring delta is baseline minus participant. Lender, treasurer and analyst use participant minus baseline. Lender and borrower experiments use different assumptions and remain independent. The paired replay is a simplified model, not observed financial impact.',[refs.matched,refs.replay,refs.technical]);
}

// 14. Hidden backup: an inspectable and runnable evidence chain.
{
 const s=slide('How a reviewer can reproduce the evidence',{backup:true});
 table(s,[['Run from server/','Purpose','What it needs'],['npm run benchmark:finance','Synthetic fixture versus rules','Node.js 24, npm, Git'],['npm run benchmark:finance -- --live','Live provider versus rules','Own API key and network'],['npm run evidence:finance','Migration and integration logs','Disposable local PostgreSQL'],['npm run evidence:finance -- --replay FILE.json','Verify frozen outcome replay','Exported JSON, no database']],76,268,1448,388,[650,414,384],24);
 text(s,'Evidence reports retain the tested revision, inputs and outcome basis.',76,716,1440,49,31,{bold:true});
 caption(s,'Live keys stay in the environment or Git-ignored .env.benchmark. Integration evidence uses local simulator_test only.');
 note(s,'Install the server dependencies first. Offline benchmark mode uses deterministic fixtures, not AI, and needs no database. Live mode needs the reviewer’s own OpenAI key. The evidence runner requires EVIDENCE_DATABASE_URL pointing to 127.0.0.1 and the disposable simulator_test database. It creates a fresh schema, applies migrations and disables paid AI. Replay requires installed dependencies and the exported JSON only. Outputs are JSON reports that can be regenerated. The source README has the full setup and deployment instructions. Private repositories require an invitation.',['README.md','server/scripts/benchmark-finance.ts','server/scripts/evidence-scenarios.ts',refs.logs,refs.replay]);
}

// 15. Hidden backup: boundary between demonstrated controls and further operating work.
{
 const s=slide('Current scope and next validation',{backup:true});
 copy(s,'Demonstrated','Scoped finance workflows, financial guards,\nlocal integration evidence and live policy calls.',76,278,1440,{size:31});
 rule(s,76,461,1448);
 copy(s,'Before sensitive production use','Review browser sessions and provider data handling.\nStrengthen audit guarantees and test backup restoration.',76,504,1440,{size:31});
 copy(s,'Before any real lending','Revalidate final terms and current affordability.\nAssess legal obligations and external execution controls.',76,691,1440,{size:29});
 note(s,'The project is a working sandbox prototype. Known risks include localStorage access tokens, incomplete redaction, trusted administrators, mutable or missing audit records, no verified application-wide rate limiting, unmeasured restore capability, Float-based money and heuristic models. Offer acceptance does not re-underwrite current affordability. These are documented limitations, not completed certifications. Stronger controls and a separate legal assessment would precede real lending or sensitive customer deployment.',[refs.security,refs.technical]);
}

const manifest={mainSlides:12,backupSlides:3,backupHidden:true,mainSpeakingSeconds:timings.reduce((a,b)=>a+b,0),font,slideSize:{width:1600,height:900},evidence:[refs.benchmark,refs.matched,refs.logs,refs.replay],screenshots:'Illustrative local demo data. See assets/provenance.json.',sourcesInSpeakerNotes:true};
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
 await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','15240000,8572500','--validate-heading-fit',...[10,13,14].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:15,requiredNativeTableOwnerSlides:[10,13,14],requiredNativeChartOwnerSlides:[11],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(build,path.basename(final)+'.validation.json')});
 console.log(`Finalized: ${final}`);
}else{
 console.log('Draft exported. Set PRESENTATION_SKILL_DIR and the runtime paths to run the finalizer.');
}
