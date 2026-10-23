import { saveServiceAction } from "@/server/actions/artisan";
import { Field, TextArea } from "@/components/ui";
import { koboToNaira } from "@/lib/money";

interface Props { categories: { _id: unknown; name: string }[]; service?: { _id: unknown; title: string; description?: string | null; category: unknown; pricingModel: string; priceKobo?: number | null; travelKobo?: number | null; durationMinutes: number } }

export function ServiceForm({ categories, service }: Props) {
  return (
    <form action={saveServiceAction} className="panel space-y-4">
      {service && <input type="hidden" name="serviceId" value={String(service._id)} />}
      <Field label="Service title" name="title" required defaultValue={service?.title} placeholder="e.g. Fix leaking tap or pipe" />
      <TextArea label="What's included" name="description" defaultValue={service?.description ?? ""} hint="Describe the work, what you bring, and anything the customer should prepare." />
      <div><label htmlFor="category" className="label">Category</label>
        <select id="category" name="category" className="input" required defaultValue={service ? String(service.category) : ""}><option value="" disabled>Choose…</option>{categories.map((c) => <option key={String(c._id)} value={String(c._id)}>{c.name}</option>)}</select></div>
      <div><label htmlFor="pricingModel" className="label">How do you price this?</label>
        <select id="pricingModel" name="pricingModel" className="input" defaultValue={service?.pricingModel ?? "fixed"}>
          <option value="fixed">Fixed price: customer sees the exact price</option><option value="starting_from">Starting price: you confirm the final price before they pay</option><option value="quote">Request a quote: you price each job after seeing the details</option></select></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price (₦)" name="price" inputMode="decimal" defaultValue={service?.priceKobo ? koboToNaira(service.priceKobo) : ""} hint="Leave blank for quote-based services." />
        <Field label="Travel charge (₦, optional)" name="travel" inputMode="decimal" defaultValue={service?.travelKobo ? koboToNaira(service.travelKobo) : ""} />
      </div>
      <div><label htmlFor="durationMinutes" className="label">Usual duration</label>
        <select id="durationMinutes" name="durationMinutes" className="input" defaultValue={service?.durationMinutes ?? 60}>{[30, 60, 90, 120, 180, 240, 360, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} ${m === 60 ? "hour" : "hours"}`}</option>)}</select>
        <p className="hint">This much of your calendar is blocked for each booking.</p></div>
      <button className="btn btn-primary">{service ? "Save changes" : "Add service"}</button>
    </form>
  );
}
