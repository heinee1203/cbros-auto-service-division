export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="schedule-dark -m-4 md:-m-6 p-4 md:p-6 rounded-lg">
      {children}
    </div>
  );
}
