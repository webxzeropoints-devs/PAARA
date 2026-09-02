import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.paarajewellery.in";
const DEFAULT_IMAGE = `${SITE_URL}/favicon.png`;

export default function Seo({ title, description, image = DEFAULT_IMAGE, type = "website" }) {
  const fullTitle = title === "Paara Jewellery" ? title : `${title} | Paara Jewellery`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Paara Jewellery" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
