/** All money is integer KOBO (1 NGN = 100 kobo). Never use floats for money. */
export interface FeeSettings {
  commissionBps: number; // % of artisan service charge taken from the artisan. 1000 = 10%
  customerFeeBps: number; // optional % booking fee added for the customer
  customerFeeFlatKobo: number; // optional flat booking fee
  customerFeeCapKobo: number | null;
}

export interface PriceBreakdown {
  serviceChargeKobo: number; // set by artisan (or approved quote)
  travelKobo: number; // set by artisan
  customerFeeKobo: number; // platform revenue, shown to customer
  totalKobo: number; // what the customer pays
  commissionKobo: number; // platform revenue, deducted from artisan
  artisanDueKobo: number; // owed to artisan after commission
  platformRevenueKobo: number; // commission + customer fee
}

const intBps = (n: number) => Number.isInteger(n) && n >= 0 && n <= 10000;
const intKobo = (n: number) => Number.isInteger(n) && n >= 0;

export function computeBreakdown(serviceChargeKobo: number, travelKobo: number, s: FeeSettings): PriceBreakdown {
  if (!intKobo(serviceChargeKobo) || serviceChargeKobo === 0) throw new RangeError("Service charge must be a positive whole number of kobo.");
  if (!intKobo(travelKobo)) throw new RangeError("Travel charge must be a whole number of kobo.");
  if (!intBps(s.commissionBps) || !intBps(s.customerFeeBps)) throw new RangeError("Fee percentages must be 0-100%.");
  if (!intKobo(s.customerFeeFlatKobo)) throw new RangeError("Flat fee must be whole kobo.");

  let customerFee = Math.round((serviceChargeKobo * s.customerFeeBps) / 10000) + s.customerFeeFlatKobo;
  if (s.customerFeeCapKobo !== null) customerFee = Math.min(customerFee, s.customerFeeCapKobo);

  const commission = Math.round((serviceChargeKobo * s.commissionBps) / 10000); // service charge only, not travel
  return {
    serviceChargeKobo,
    travelKobo,
    customerFeeKobo: customerFee,
    totalKobo: serviceChargeKobo + travelKobo + customerFee,
    commissionKobo: commission,
    artisanDueKobo: serviceChargeKobo + travelKobo - commission,
    platformRevenueKobo: commission + customerFee,
  };
}

export const formatNaira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(kobo / 100);
