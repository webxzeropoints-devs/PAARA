import AccountPageLayout from "../account/AccountPageLayout";
import Seo from "../../components/Seo";

export default function ReturnPolicy() {
  return (
    <AccountPageLayout title="Return & Refund Policy">
      <Seo title="Return & Refund Policy" description="Read the Paara Jewellery return and refund policy." />
      <article className="max-w-3xl space-y-8 text-sm leading-relaxed text-cocoa/80">
        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">RETURN &amp; REFUND POLICY</h2>
          <p>At Paara Jewellery, we carefully pack every order before it leaves us. If your package arrives damaged or the jewellery has been damaged during delivery, we are here to help.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">PACKAGE OPENING VIDEO — IMPORTANT</h2>
          <p className="mb-3">We strongly require customers to record a continuous, unedited video while opening their package.</p>
          <p className="mb-2">The video should clearly show:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The unopened package</li>
            <li>The package label/order details</li>
            <li>The condition of the package before opening</li>
            <li>The complete opening process</li>
            <li>The jewellery and its condition immediately after opening</li>
          </ul>
          <p className="mt-3">This video is required to support a claim for damage during delivery.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">DAMAGED PRODUCT CLAIMS</h2>
          <p>If your jewellery arrives damaged, you may request a return within 14 days of receiving your order, provided you have a valid package-opening video showing the condition of the package and product when it was opened.</p>
          <p className="mt-3">Claims without a package-opening video may not be eligible for a damage-related return or refund.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">RETURN PROCESS</h2>
          <p className="mb-3">If your return request is approved:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Contact Paara Jewellery within 14 days of receiving your order.</li>
            <li>Share your order details and the required package-opening video.</li>
            <li>Our team will review the claim.</li>
            <li>Once approved, you will be instructed to securely courier the product and its original packaging back to Paara Jewellery.</li>
            <li>After the returned product is received and verified, the eligible refund will be processed.</li>
          </ol>
        </section>

        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">RETURN CONDITION</h2>
          <p>The product should be returned with its original packaging and accessories, wherever applicable.</p>
          <p className="mt-3">Products that show signs of use, alteration, intentional damage, or missing original packaging may not qualify for a return.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">REFUNDS</h2>
          <p>For an approved return, the eligible amount will be refunded after the returned product has been received and verified by Paara Jewellery.</p>
          <p className="mt-3">The refund will be processed to the original payment method or through the applicable refund method used by Paara Jewellery.</p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-cocoa mb-3">IMPORTANT</h2>
          <p>Please do not discard the original packaging until you have checked your order and confirmed that the jewellery has arrived safely.</p>
          <p className="mt-3">For any return or damage-related assistance, please contact Paara Jewellery with your order number and relevant details.</p>
        </section>
      </article>
    </AccountPageLayout>
  );
}
