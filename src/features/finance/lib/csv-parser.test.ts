import { describe, expect, it } from "vitest";

import type {
  ColumnMapping,
  Transaction,
} from "@/features/finance/types/finance";
import { parseCSV, parseCSVManual } from "./csv-parser";

const chaseCreditCardCsv = [
  "Transaction Date,Post Date,Description,Category,Type,Amount",
  "01/05/2026,01/06/2026,COFFEE SHOP,Food & Drink,Sale,4.25",
].join("\n");

const manualCsv = [
  "Date,Merchant,Amount,Category",
  "2026-01-06,COFFEE SHOP,-4.25,Food & Drink",
].join("\n");

const manualMapping: ColumnMapping = {
  date: 0,
  description: 1,
  amount: 2,
  category: 3,
};

function expectDifferentImportedRowAcrossAccountLabels(
  left: Transaction,
  right: Transaction,
) {
  expect(left.id).not.toBe(right.id);
  expect(left.importFingerprint).not.toBe(right.importFingerprint);
}

function expectStableImportedRowForSameAccountLabel(
  left: Transaction,
  right: Transaction,
) {
  expect(left.id).toBe(right.id);
  expect(left.importFingerprint).toBe(right.importFingerprint);
}

describe("finance CSV import identity", () => {
  it("keeps auto-detected import fingerprints account-label-specific", () => {
    const cardUpload = parseCSV(chaseCreditCardCsv, "chase_cc", "Visa 1234");
    const otherCardUpload = parseCSV(
      chaseCreditCardCsv,
      "chase_cc",
      "Visa 9876",
    );
    const repeatedCardUpload = parseCSV(
      chaseCreditCardCsv,
      "chase_cc",
      "Visa 1234",
    );

    expect(cardUpload).toHaveLength(1);
    expect(otherCardUpload).toHaveLength(1);
    expect(repeatedCardUpload).toHaveLength(1);
    expectDifferentImportedRowAcrossAccountLabels(
      cardUpload[0],
      otherCardUpload[0],
    );
    expectStableImportedRowForSameAccountLabel(
      cardUpload[0],
      repeatedCardUpload[0],
    );
  });

  it("keeps manual import fingerprints account-label-specific", () => {
    const checkingUpload = parseCSVManual(
      manualCsv,
      manualMapping,
      "Checking 0001",
    );
    const savingsUpload = parseCSVManual(
      manualCsv,
      manualMapping,
      "Savings 0002",
    );
    const repeatedCheckingUpload = parseCSVManual(
      manualCsv,
      manualMapping,
      "Checking 0001",
    );

    expect(checkingUpload).toHaveLength(1);
    expect(savingsUpload).toHaveLength(1);
    expect(repeatedCheckingUpload).toHaveLength(1);
    expectDifferentImportedRowAcrossAccountLabels(
      checkingUpload[0],
      savingsUpload[0],
    );
    expectStableImportedRowForSameAccountLabel(
      checkingUpload[0],
      repeatedCheckingUpload[0],
    );
  });

  it("suffixes repeated duplicate auto-detected rows so a single import preserves both occurrences", () => {
    const duplicateRowsCsv = [
      "Transaction Date,Post Date,Description,Category,Type,Amount",
      "01/05/2026,01/06/2026,COFFEE SHOP,Food & Drink,Sale,4.25",
      "01/05/2026,01/06/2026,COFFEE SHOP,Food & Drink,Sale,4.25",
    ].join("\n");

    const transactions = parseCSV(duplicateRowsCsv, "chase_cc", "Visa 1234");

    expect(transactions).toHaveLength(2);
    expect(transactions[0].id).not.toBe(transactions[1].id);
    expect(transactions[0].importFingerprint).not.toBe(
      transactions[1].importFingerprint,
    );
    expect(transactions.map((transaction) => transaction.id)).toEqual([
      expect.stringMatching(/-1$/),
      expect.stringMatching(/-2$/),
    ]);
    expect(
      transactions.map((transaction) => transaction.importFingerprint),
    ).toEqual([expect.stringMatching(/-1$/), expect.stringMatching(/-2$/)]);
  });

  it("suffixes repeated duplicate manual rows so a single import preserves both occurrences", () => {
    const duplicateRowsCsv = [
      "Date,Merchant,Amount,Category",
      "2026-01-06,COFFEE SHOP,-4.25,Food & Drink",
      "2026-01-06,COFFEE SHOP,-4.25,Food & Drink",
    ].join("\n");

    const transactions = parseCSVManual(
      duplicateRowsCsv,
      manualMapping,
      "Checking 0001",
    );

    expect(transactions).toHaveLength(2);
    expect(transactions[0].id).not.toBe(transactions[1].id);
    expect(transactions[0].importFingerprint).not.toBe(
      transactions[1].importFingerprint,
    );
    expect(transactions.map((transaction) => transaction.id)).toEqual([
      expect.stringMatching(/-1$/),
      expect.stringMatching(/-2$/),
    ]);
    expect(
      transactions.map((transaction) => transaction.importFingerprint),
    ).toEqual([expect.stringMatching(/-1$/), expect.stringMatching(/-2$/)]);
  });
});
