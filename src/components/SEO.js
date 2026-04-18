export default function SEO({ title, description }) {
  const metaDescription =
    description ||
    'Tuning Digital helps you optimise websites, tools, and workflows for better performance and results.';

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={metaDescription} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Tuning Digital" />
    </>
  );
}
