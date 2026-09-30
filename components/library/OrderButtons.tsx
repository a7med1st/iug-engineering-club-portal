import { ArrowDown, ArrowUp } from "lucide-react";

type Action = (data: FormData) => void | Promise<void>;

export default function OrderButtons({ action, itemId, itemName, itemField, first, last, fields = {} }: {
  action: Action;
  itemId: string;
  itemName: string;
  itemField: "folderId" | "fileId" | "linkId";
  first: boolean;
  last: boolean;
  fields?: Record<string, string>;
}) {
  return <span className="library-order-buttons">
    {(["up", "down"] as const).map((direction) => {
      const disabled = direction === "up" ? first : last;
      const label = `تحريك ${itemName} ${direction === "up" ? "للأعلى" : "للأسفل"}`;
      return <form action={action} key={direction}>
        <input type="hidden" name={itemField} value={itemId} />
        <input type="hidden" name="direction" value={direction} />
        {Object.entries(fields).map(([name, value]) => <input type="hidden" name={name} value={value} key={name} />)}
        <button type="submit" disabled={disabled} title={label} aria-label={label}>{direction === "up" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</button>
      </form>;
    })}
  </span>;
}
