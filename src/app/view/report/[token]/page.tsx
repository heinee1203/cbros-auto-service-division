import { getCompletionReportData } from "@/lib/services/release";
import { formatDate } from "@/lib/utils";
import { SERVICE_WARRANTY_MAP } from "@/lib/constants";
import { BeforeAfterViewer } from "@/components/release/before-after-viewer";
import PrintButton from "./print-button";

interface PublicReportPageProps {
  params: { token: string };
}

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const data = await getCompletionReportData(params.token);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Report Not Found</h1>
          <p className="mt-2 text-surface-500">
            This report link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const { release, jobOrder, customer, vehicle, beforeAfterPhotos, warranties, shopInfo, careInstructions } = data;

  const customerName = customer.company
    ? customer.company
    : `${customer.firstName} ${customer.lastName}`;

  const now = new Date();

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 20mm; }
              .no-print { display: none !important; }
              body { background: white !important; }
            }
          `,
        }}
      />

      <div className="min-h-screen bg-surface-100 py-8 px-4">
        <div className="mx-auto max-w-[800px] bg-white shadow-sm rounded-lg overflow-hidden">
          {/* A. Shop Header */}
          <div className="border-b border-surface-200 px-8 py-6 text-center">
            <h1 className="text-2xl font-bold text-primary">
              {shopInfo.shop_name || "AutoServ Pro"}
            </h1>
            {shopInfo.shop_address && (
              <p className="mt-1 text-sm text-surface-500">
                {shopInfo.shop_address}
              </p>
            )}
            <div className="mt-1 flex items-center justify-center gap-4 text-sm text-surface-500">
              {shopInfo.shop_phone && <span>{shopInfo.shop_phone}</span>}
              {shopInfo.shop_email && <span>{shopInfo.shop_email}</span>}
            </div>
            <h2 className="mt-4 text-lg font-bold uppercase tracking-wide text-primary">
              Vehicle Service Completion Report
            </h2>
          </div>

          {/* B. Vehicle + Customer Info */}
          <div className="border-b border-surface-200 px-8 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Vehicle
                </h3>
                {vehicle && (
                  <>
                    <p className="mt-1 font-medium text-primary">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    {vehicle.color && (
                      <p className="text-sm text-surface-500">
                        Color: {vehicle.color}
                      </p>
                    )}
                    {vehicle.plateNumber && (
                      <p className="text-sm text-surface-500">
                        Plate: {vehicle.plateNumber}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                  Customer
                </h3>
                <p className="mt-1 font-medium text-primary">{customerName}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-surface-400">Job Order: </span>
                <span className="font-medium text-primary">
                  {jobOrder.jobOrderNumber}
                </span>
              </div>
              <div>
                <span className="text-surface-400">Service Period: </span>
                <span className="font-medium text-primary">
                  {formatDate(jobOrder.createdAt)}
                  {release.releaseDate && ` — ${formatDate(release.releaseDate)}`}
                </span>
              </div>
            </div>
          </div>

          {/* C. Services Performed */}
          {data.serviceCategories && data.serviceCategories.length > 0 && (
            <div className="border-b border-surface-200 px-8 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400 mb-2">
                Services Performed
              </h3>
              <ul className="space-y-1">
                {data.serviceCategories.map((category: string) => {
                  const config = SERVICE_WARRANTY_MAP[category as keyof typeof SERVICE_WARRANTY_MAP];
                  return (
                    <li key={category} className="flex items-center gap-2 text-sm text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-500 flex-shrink-0" />
                      {config?.label || category}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* D. Before/After Section */}
          <div className="border-b border-surface-200 px-8 py-4">
            <BeforeAfterViewer
              pairs={beforeAfterPhotos.pairs}
              unmatchedIntake={beforeAfterPhotos.unmatchedIntake}
              unmatchedRelease={beforeAfterPhotos.unmatchedRelease}
            />
          </div>

          {/* E. Warranty Details */}
          {warranties.length > 0 && (
            <div className="border-b border-surface-200 px-8 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400 mb-3">
                Warranty Details
              </h3>
              <div className="space-y-3">
                {warranties.map((warranty) => {
                  const isActive = new Date(warranty.endDate) > now;
                  return (
                    <div
                      key={warranty.id}
                      className="rounded-lg border border-surface-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-primary">
                            {warranty.description || warranty.serviceCategory}
                          </p>
                          <p className="text-sm text-surface-500 mt-1">
                            {formatDate(warranty.startDate)} — {formatDate(warranty.endDate)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                            isActive
                              ? "bg-success-100 text-success-700"
                              : "bg-danger-100 text-danger-700"
                          }`}
                        >
                          {isActive
                            ? `Active — expires ${formatDate(warranty.endDate)}`
                            : `Expired on ${formatDate(warranty.endDate)}`}
                        </span>
                      </div>
                      {warranty.terms && (
                        <p className="mt-2 text-xs text-surface-500 whitespace-pre-wrap">
                          {warranty.terms}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* F. Care Instructions */}
          {Object.keys(careInstructions).length > 0 && (
            <div className="border-b border-surface-200 px-8 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-400 mb-3">
                Care Instructions
              </h3>
              <div className="space-y-3">
                {Object.entries(careInstructions).map(([category, instructions]) => {
                  const config = SERVICE_WARRANTY_MAP[category as keyof typeof SERVICE_WARRANTY_MAP];
                  return (
                    <div
                      key={category}
                      className="rounded-lg bg-blue-50 border border-blue-200 p-4"
                    >
                      <p className="text-sm font-medium text-blue-900">
                        {config?.label || category}
                      </p>
                      <p className="mt-1 text-sm text-blue-800 whitespace-pre-wrap">
                        {instructions}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* H. Footer */}
          <div className="px-8 py-4 text-center text-xs text-surface-400">
            <p>
              Thank you for choosing {shopInfo.shop_name || "AutoServ Pro"}!
            </p>
            {(shopInfo.shop_phone || shopInfo.shop_email) && (
              <p className="mt-1">
                {shopInfo.shop_phone && <span>{shopInfo.shop_phone}</span>}
                {shopInfo.shop_phone && shopInfo.shop_email && <span> | </span>}
                {shopInfo.shop_email && <span>{shopInfo.shop_email}</span>}
              </p>
            )}
            <p className="mt-2 text-surface-300">Powered by AutoServ Pro</p>
          </div>
        </div>
      </div>

      <PrintButton />
    </>
  );
}
