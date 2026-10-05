const GST_PERCENT = 18;

export function calculateTaxInclusiveGST(totalPaise: number) {
  const gstPaise = Math.round(totalPaise * GST_PERCENT / (100 + GST_PERCENT));
  return { subtotalPaise: totalPaise, gstPaise, basePaise: totalPaise - gstPaise };
}
