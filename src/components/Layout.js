import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';
import SEO from './SEO';
import AdSenseBlock from './AdSenseBlock';

export default function Layout({ children, title, description }) {
  const fullTitle = title || 'Tuning Digital – Optimise Your Online Presence';

  return (
    <>
      <Head>
        <SEO title={fullTitle} description={description} />
      </Head>
      <Header />
      <main>
        <AdSenseBlock position="top" />
        {children}
        <AdSenseBlock position="bottom" />
      </main>
      <Footer />
    </>
  );
}
