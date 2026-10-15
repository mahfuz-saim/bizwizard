export default function GenerateReceiptHtml({ checkOutData }) {
	const productData = checkOutData?.items || []
	let totalPrice = 0

	let discounts = [] // Array of discount objects: {productName, quantity, amount}
	let totalDiscounts = 0
	const discountedTotal = checkOutData.totalPrice
	const dueStatus = checkOutData?.status
	const shopName = checkOutData.shop.shopName
	const shopAddress = checkOutData.shop.address || {
		street: '',
		upazila: '',
		district: '',
	}
	const shopOwnerName = checkOutData.shop.owner.name || ''
	const contactNo = checkOutData.shop.contact

	const sellTime = new Date(checkOutData.createdAt).toLocaleString()
	const sellDate = new Date(checkOutData.createdAt).toLocaleDateString()

	const customerName = checkOutData?.buyer?.Shops[0]?.name || 'Walk-in Customer'
	const customerContact = checkOutData?.buyer?.number || ''

	const soldBy = {
		name: '',
		number: '',
	}

	if (checkOutData?.soldBy) {
		if (checkOutData?.soldBy === 'OWNER') {
			soldBy.name = checkOutData.soldByOwner.name
			soldBy.number = checkOutData.soldByOwner.number
		} else if (checkOutData?.soldBy === 'EMPLOYEE') {
			soldBy.name = checkOutData.soldByEmployee.name
			soldBy.number = checkOutData.soldByEmployee.number
		}
	}

	// Generate product rows
	let productRows = ''
	if (checkOutData.totalDiscount > 0) {
		discounts.push({
			productName: 'EXTRA DISCOUNT',
			quantity: 1,
			amount: checkOutData.totalDiscount,
		})
		totalDiscounts += checkOutData.totalDiscount
	}
	productData.forEach((row, index) => {
		const rowTotal = row.quantity * row.unitPrice
		totalPrice += rowTotal
		if (row.itemDiscount > 0) {
			const lineDiscount = rowTotal - row.quantity * row.discountedPrice
			totalDiscounts += lineDiscount
			discounts.push({
				productName: row.productName,
				quantity: row.quantity,
				amount: lineDiscount,
			})
		}
		productRows += `
                  <tr>
                    <td class="serial-col">${index + 1}</td>
                     <td class="name-col">${row.productName}[${
												row?.variantName || ''
											}]</td>
                     <td class="price-col">৳${row.unitPrice}</td>
                     <td class="qty-col">${row.quantity}</td>
                     <td class="total-col">৳${rowTotal}</td>
                  </tr>`
	})

	const finalTotal = checkOutData.totalPrice
	const paidAmount = checkOutData?.Debt?.paidAmount || finalTotal
	let dueAmount = finalTotal - paidAmount

	// Generate discount rows
	let discountRows = ''
	if (discounts && discounts.length > 0) {
		discounts.forEach((discount) => {
			discountRows += `
            <div class="discount-item">
               <span>${discount.productName} x ${discount.quantity}</span>
               <span>৳${discount.amount}</span>
            </div>`
		})
	}

	totalDiscounts = totalDiscounts.toFixed(2)

	let template = `
<html>
   <head>
      <style>
         body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 40px;
            background-color: #f5f5f5;
            min-height: 100vh;
            box-sizing: border-box;
         }
         .receipt-container {
            width: 100%;
            max-width: none;
            margin: 0;
            background: white;
            padding: 40px;
            border: 1px solid #ddd;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            box-sizing: border-box;
            min-height: calc(100vh - 80px);
         }
         .shop-info {
            text-align: center;
            border-bottom: 2px dashed #333;
            padding-bottom: 15px;
            margin-bottom: 15px;
         }
         .shop-name {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 5px;
         }
         .shop-details {
            font-size: 12px;
            line-height: 1.4;
            color: #555;
         }
         .receipt-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 15px 0;
            text-transform: uppercase;
         }
         .products-section {
            margin: 15px 0;
         }
         .products-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
         }
         .products-table th {
            background-color: #333;
            color: white;
            padding: 8px 4px;
            text-align: left;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
         }
         .products-table td {
            padding: 6px 4px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
         }
         .products-table .serial-col { width: 8%; }
         .products-table .name-col { width: 40%; }
         .products-table .price-col { width: 17%; }
         .products-table .qty-col { width: 10%; }
         .products-table .total-col { width: 20%; text-align: right; }
         .summary-section {
            margin-top: 15px;
            border-top: 1px dashed #666;
            padding-top: 10px;
         }
         .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 13px;
         }
         .total-row {
            font-weight: bold;
            font-size: 15px;
            border-top: 1px solid #333;
            border-bottom: 1px solid #333;
            padding: 8px 0;
            margin: 8px 0;
         }
         .discounts-section {
            margin: 15px 0;
            border-top: 1px dashed #666;
            padding-top: 10px;
         }
         .discount-title {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 13px;
            text-transform: uppercase;
         }
         .discount-item {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin: 3px 0;
            color: #666;
         }
         .status {
            text-align: left;
            font-weight: bold;
            margin: 15px 0;
            font-size: 14px;
            color: #2d5f3f;
            text-transform: uppercase;
         }
         .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px dashed #333;
            font-size: 10px;
            color: #888;
         }
         .bebsapati-info {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
         }
         .date-time {
            text-align: center;
            font-size: 11px;
            color: #666;
            margin-bottom: 10px;
         }
         .due-info {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin: 10px 0;
            font-weight: bold;
         }
         .customer-info {
            text-align: left;
            font-size: 12px;
            margin: 10px 0;
            color: #555;
         }
      </style>
   </head>
   <body>
      <div class="receipt-container">
         <!-- Shop Information -->
         <div class="shop-info">
            <div class="shop-name">${shopName}</div>
            ${
							shopAddress
								? `<div class="shop-details">${shopAddress.street},${shopAddress.upazila},${shopAddress.district} </div>`
								: ''
						}
            ${
							shopOwnerName
								? `<div class="shop-details">Owner: ${shopOwnerName}</div>`
								: ''
						}
            ${
							contactNo
								? `<div class="shop-details">Contact: ${contactNo}</div>`
								: ''
						}

            ${sellDate} ${sellTime}
         </div>

         <!-- Receipt Title -->
         <div class="receipt-title">Cash Receipt</div>

         <!-- Products Section -->
         <div class="products-section">
            <table class="products-table">
               <thead>
                  <tr>
                     <th class="serial-col">SL</th>
                     <th class="name-col">Product Name</th>
                     <th class="price-col">Unit Price</th>
                     <th class="qty-col">Qty</th>
                     <th class="total-col">Total</th>
                  </tr>
               </thead>
               <tbody>
                  <!-- Product rows will go here -->
               </tbody>
            </table>
         </div>

         <!-- Summary Section -->
         <div class="summary-section">
            <div class="summary-row total-row">
               <span>TOTAL</span>
               <span>৳${totalPrice}</span>
            </div>
         </div>

         <!-- Discounts Section -->
         ${
						discounts && discounts.length > 0
							? `
         <div class="discounts-section">
            <div class="discount-title">Discounts Applied</div>
            <!-- Discount items will go here -->
            <div class="summary-row" style="border-top: 1px solid #ddd; padding-top: 5px; margin-top: 8px;">
               <span><strong>Total Discounts</strong></span>
               <span><strong>৳${totalDiscounts}</strong></span>
            </div>
            <div class="summary-row total-row" style="color: #2d5f3f;">
               <span>FINAL TOTAL</span>
               <span>৳${discountedTotal}</span>
            </div>
         </div>
         `
							: ''
					}

         <!-- Paid Amount Information -->
            <div class="summary-row ">
               <span>Paid Amount</span>
               <span>৳${paidAmount}</span>
            </div>
         <!-- Due Information -->
         <div class="due-info">
            <span>Status: ${dueStatus}</span>
            <span>Due: ৳${dueAmount}</span>
         </div>

         <!-- Customer Information -->
         ${
						customerName
							? `
         <div class="customer-info">
            <strong>Served to:</strong> 
			${customerName} ${customerContact ? ` [${customerContact}]` : ''}
         </div>
         `
							: ''
					}

         <div class="customer-info">
            <strong>Served by:</strong> ${soldBy.name}
         </div>

         <!-- Footer -->
         <div class="footer">
            <div class="bebsapati-info">
               <span>Automatically generated by Bebsapati</span>
            </div>
         </div>
      </div>
   </body>
</html>
`
	// Replace placeholders
	template = template.replace('<!-- Product rows will go here -->', productRows)
	template = template.replace(
		'<!-- Discount items will go here -->',
		discountRows
	)

	return template
}
