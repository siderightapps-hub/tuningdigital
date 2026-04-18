import Layout from 'components/Layout';
import { getPostSlugs, getPostBySlug } from 'lib/posts';
import markdownToHtml from 'lib/markdownToHtml';

export default function PostPage({ title, date, excerpt, content }) {
  return (
    <Layout title={title} description={excerpt}>
      <article>
        <h1>{title}</h1>
        <small>{date}</small>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>
    </Layout>
  );
}

export async function getStaticProps({ params }) {
  const { meta, content } = getPostBySlug(params.slug);
  const html = await markdownToHtml(content);

  return {
    props: {
      title: meta.title,
      date: meta.date,
      excerpt: meta.excerpt,
      content: html
    }
  };
}

export async function getStaticPaths() {
  const slugs = getPostSlugs().map((s) => s.replace(/\.md$/, ''));
  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    fallback: false
  };
}
