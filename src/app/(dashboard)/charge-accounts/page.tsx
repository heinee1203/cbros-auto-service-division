import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getChargeAccounts } from "@/lib/services/charge-accounts";
import { ChargeAccountsClient } from "./charge-accounts-client";

export default async function ChargeAccountsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const accounts = await getChargeAccounts();

  const serialized = accounts.map((a) => ({
    id: a.id,
    companyName: a.companyName,
    contactPerson: a.contactPerson,
    phone: a.phone,
    email: a.email,
    address: a.address,
    tinNumber: a.tinNumber,
    creditTerms: a.creditTerms,
    creditLimit: a.creditLimit,
    currentBalance: a.currentBalance,
    isActive: a.isActive,
    notes: a.notes,
  }));

  return <ChargeAccountsClient accounts={serialized} />;
}
