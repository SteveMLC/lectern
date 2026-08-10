# Private reimbursement evidence

Place raw provider JSONL exports, invoices, and subscription receipts here. Everything in this directory except this instruction file is ignored by git.

Do not rename or edit a raw log after its SHA-256 has been recorded in `usage/ledger.jsonl`. If a live log grows, run another snapshot; the next entry records the incremental counters and the new digest.

For an invoice or subscription receipt, keep the raw file here and run `pnpm usage:receipt -- ...`. The tracked receipt allocation contains only its SHA-256, byte size, billed amount, period, and covered usage-entry ids. Do not edit old ledger entries or commit the private source file.
