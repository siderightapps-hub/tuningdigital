import React from 'react';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        body {
          margin: 0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f7f7f7;
          color: #111;
        }
        a {
          color: #0b5fff;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        main {
          max-width: 800px;
          margin: 0 auto;
          padding: 1.5rem;
          background: #fff;
        }
        header,
        footer {
          max-width: 800px;
          margin: 0 auto;
          padding: 1rem 1.5rem;
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
