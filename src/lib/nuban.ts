// Nigerian NUBAN account numbers carry a check digit (CBN's NUBAN spec), so a
// wrong or made-up 10-digit number can be caught without ever calling
// Paystack's paid account-resolution endpoint. But the checksum needs the
// bank's 3-digit CBN institution code, and that's only reliably documented
// for the older deposit money banks below -- most MFBs, PSBs, and fintechs
// (Opay, Kuda, Moniepoint, PalmPay, Carbon, etc.) settle NUBAN transfers
// through a sponsor bank whose code isn't consistently published, so getting
// one wrong here would silently block genuine sellers at those institutions.
// Deliberately partial: only flag banks we're confident about, treat every
// other bank as "can't tell" rather than guess.
const NUBAN_BANK_CODES: Record<string, string> = {
  "Access Bank": "044",
  "Access Bank (Diamond)": "063",
  "Citibank Nigeria": "023",
  "Ecobank Nigeria": "050",
  "Fidelity Bank": "070",
  "First Bank of Nigeria": "011",
  "First City Monument Bank": "214",
  "Guaranty Trust Bank": "058",
  "Jaiz Bank": "301",
  "Keystone Bank": "082",
  "Polaris Bank": "076",
  "Providus Bank": "101",
  "Stanbic IBTC Bank": "221",
  "Standard Chartered Bank": "068",
  "Sterling Bank": "232",
  "Suntrust Bank": "100",
  "Union Bank of Nigeria": "032",
  "United Bank For Africa": "033",
  "Unity Bank": "215",
  "Wema Bank": "035",
  "Zenith Bank": "057",
};

// CBN NUBAN check-digit algorithm: bank code (3 digits) + first 9 digits of
// the account number, weighted [3,7,3, 3,7,3, 3,7,3, 3,7,3], summed mod 10,
// must equal the 10th digit.
function nubanCheckDigitValid(bankCode: string, accountNumber: string): boolean {
  const digits = (bankCode + accountNumber.slice(0, 9)).split("").map(Number);
  const weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
  const sum = digits.reduce((total, d, i) => total + d * weights[i], 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(accountNumber[9]);
}

export type NubanCheckResult = "valid" | "invalid" | "unknown";

// "unknown" covers both "not a bank we have a code for" and "not a 10-digit
// number yet" -- callers should only surface a warning on "invalid", never
// block saving on it.
export function checkNubanAccountNumber(bankName: string, accountNumber: string): NubanCheckResult {
  const bankCode = NUBAN_BANK_CODES[bankName];
  if (!bankCode || !/^\d{10}$/.test(accountNumber)) return "unknown";
  return nubanCheckDigitValid(bankCode, accountNumber) ? "valid" : "invalid";
}
