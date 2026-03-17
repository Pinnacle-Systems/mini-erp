import { formatCurrency } from "./useSalesDocumentWorkspace";

type PrintableReceiptLine = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: number;
};

export type PrintableReceiptData = {
  businessName: string;
  billNumber: string;
  postedAt: string;
  customerName: string;
  locationName: string | null;
  lines: PrintableReceiptLine[];
  subTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountTendered: number;
  changeDue: number;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
};

export function PrintableReceipt({
  receipt,
}: {
  receipt: PrintableReceiptData | null;
}) {
  if (!receipt) {
    return null;
  }

  return (
    <section className="pos-receipt-container" aria-hidden="true">
      <div className="pos-receipt">
        <header className="pos-receipt__header">
          <div className="pos-receipt__business">{receipt.businessName}</div>
          <div>Cash Receipt</div>
          <div>{receipt.billNumber}</div>
          <div>{formatTimestamp(receipt.postedAt)}</div>
          {receipt.locationName ? <div>{receipt.locationName}</div> : null}
          {receipt.customerName ? <div>Customer: {receipt.customerName}</div> : null}
        </header>

        <div className="pos-receipt__divider" />

        <div className="pos-receipt__lines">
          {receipt.lines.map((line) => (
            <div key={line.id} className="pos-receipt__line">
              <div className="pos-receipt__line-title">{line.description}</div>
              <div className="pos-receipt__line-meta">
                <span>
                  {line.quantity} x {formatCurrency(Number(line.unitPrice) || 0)}
                </span>
                <span>{formatCurrency(line.total)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pos-receipt__divider" />

        <div className="pos-receipt__totals">
          <div className="pos-receipt__row">
            <span>Subtotal</span>
            <span>{formatCurrency(receipt.subTotal)}</span>
          </div>
          <div className="pos-receipt__row">
            <span>Tax</span>
            <span>{formatCurrency(receipt.taxTotal)}</span>
          </div>
          <div className="pos-receipt__row pos-receipt__row--strong">
            <span>Total</span>
            <span>{formatCurrency(receipt.grandTotal)}</span>
          </div>
          <div className="pos-receipt__row">
            <span>Cash</span>
            <span>{formatCurrency(receipt.amountTendered)}</span>
          </div>
          <div className="pos-receipt__row pos-receipt__row--strong">
            <span>Change</span>
            <span>{formatCurrency(receipt.changeDue)}</span>
          </div>
        </div>

        <div className="pos-receipt__divider" />

        <footer className="pos-receipt__footer">
          <div>Thank you for your business.</div>
          <div>Powered by Mini ERP</div>
        </footer>
      </div>
    </section>
  );
}
