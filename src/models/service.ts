import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    icon: String,
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const serviceSchema = new Schema(
  {
    artisan: { type: Schema.Types.ObjectId, ref: "ArtisanProfile", required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "ServiceCategory", required: true },
    title: { type: String, required: true, maxlength: 140 },
    description: { type: String, maxlength: 2000 },
    pricingModel: { type: String, enum: ["fixed", "starting_from", "quote"], required: true },
    priceKobo: { type: Number, min: 0, validate: { validator: Number.isInteger, message: "priceKobo must be an integer" } },
    travelKobo: { type: Number, min: 0, default: 0 },
    durationMinutes: { type: Number, required: true, min: 30, max: 24 * 60 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
// Fixed and starting-from services must carry a price; quote services must not.
serviceSchema.pre("validate", function (next) {
  if (this.pricingModel === "quote") this.priceKobo = undefined;
  else if (!this.priceKobo || this.priceKobo <= 0) this.invalidate("priceKobo", "A price is required for fixed and starting-from services.");
  next();
});
serviceSchema.index({ category: 1, active: 1, pricingModel: 1, priceKobo: 1 });
serviceSchema.index({ title: "text", description: "text" });

export type ServiceDoc = InferSchemaType<typeof serviceSchema> & { _id: mongoose.Types.ObjectId };
export const ServiceCategory = (mongoose.models.ServiceCategory || mongoose.model("ServiceCategory", categorySchema)) as unknown as Model<{ _id: mongoose.Types.ObjectId; name: string; slug: string; icon?: string; active: boolean; featured: boolean; sortOrder: number }>;
export const Service: Model<ServiceDoc> = (mongoose.models.Service as Model<ServiceDoc>) || mongoose.model<ServiceDoc>("Service", serviceSchema);
