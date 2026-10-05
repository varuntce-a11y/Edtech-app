import { calculateTaxInclusiveGST } from './tax';

describe('calculateTaxInclusiveGST', () => {
  it('extracts 18% GST from an inclusive price without changing the payable total', () => {
    expect(calculateTaxInclusiveGST(118_000)).toEqual({
      subtotalPaise: 118_000,
      gstPaise: 18_000,
      basePaise: 100_000,
    });
  });

  it('rounds GST to the nearest paise', () => {
    expect(calculateTaxInclusiveGST(1)).toEqual({ subtotalPaise: 1, gstPaise: 0, basePaise: 1 });
  });
});
