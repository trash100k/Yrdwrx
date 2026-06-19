import React, { forwardRef } from "react";
import { Invoice } from "../types";
import { useTenant } from "../contexts/TenantContext";

interface Props {
  invoice: Invoice;
}

export const PrinterFriendlyInvoice = forwardRef<HTMLDivElement, Props>(
  ({ invoice }, ref) => {
    const { tenant } = useTenant();

    return (
      <div
        ref={ref}
        className="p-10 bg-white text-black font-sans min-h-screen"
        style={{ width: "100%", margin: "0 auto", boxSizing: "border-box" }}
      >
        <div className="flex justify-between items-start mb-12 border-b-2 border-gray-200 pb-8">
          <div>
            <h1 className="text-4xl font-black uppercase text-gray-900 tracking-tight">
              INVOICE
            </h1>
            <p className="text-gray-500 mt-2 font-mono text-sm">
              INV-{invoice?.id?.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-900">{tenant?.name || "Service Company"}</h2>
            <p className="text-gray-500 text-sm mt-1">123 Service Road, Suite 100</p>
            <p className="text-gray-500 text-sm">Contact: {tenant?.contactEmail || "billing@company.com"}</p>
          </div>
        </div>

        <div className="flex justify-between mb-12">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Bill To
            </h3>
            <p className="text-lg font-bold text-gray-800">{invoice?.client || "Valued Client"}</p>
            <p className="text-gray-500 text-sm mt-1">{invoice?.address || "Address on File"}</p>
          </div>
          <div className="text-right flex flex-col gap-2">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Date Issued
              </h3>
              <p className="font-medium text-gray-800">{invoice?.date || new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Status
              </h3>
              <p className="font-medium text-gray-800 uppercase">{invoice?.status || "PENDING"}</p>
            </div>
          </div>
        </div>

        <table className="w-full text-left mb-12 border-collapse border-b border-gray-200">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-widest w-2/3">
                Description
              </th>
              <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {!invoice?.items || invoice.items.length === 0 ? (
              <tr className="border-b border-gray-100">
                <td className="py-4 px-2 text-gray-800">
                  {invoice?.type || "Standard Services Rendered"}
                </td>
                <td className="py-4 px-2 text-right font-medium text-gray-800">
                  ${(invoice?.amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ) : (
              invoice?.items.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">
                    <p className="font-medium">{item.description || item.title || "Service item"}</p>
                  </td>
                  <td className="py-4 px-2 text-right font-medium text-gray-800">
                    ${(item.amount || item.price || (item.rate && item.quantity ? item.rate * item.quantity : 0) || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-end gap-12 mb-16">
          <div className="text-right">
            <p className="text-gray-500 mb-2">Subtotal:</p>
            <p className="text-gray-500 mb-2">Tax (0%):</p>
            <p className="text-2xl font-black text-gray-900 mt-4 border-t-2 border-gray-900 pt-4">
              Total: ${(invoice?.amount || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p className="mb-1">Thank you for your business!</p>
          <p>Please make checks payable to {tenant?.name || "Service Company"}.</p>
        </div>
      </div>
    );
  }
);

PrinterFriendlyInvoice.displayName = "PrinterFriendlyInvoice";
