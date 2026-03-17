import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PinClock from "@/components/time-clock/pin-clock";

export default async function FrontlinerClockPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-md mx-auto">
      <PinClock
        preAuthUser={{
          id: session.user.id,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
        }}
      />
    </div>
  );
}
