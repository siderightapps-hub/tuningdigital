import Link from 'next/link';
import Layout from 'components/Layout';
import { getAllPosts } from 'lib/posts';

export default function Home({ posts }) {
  const latest = posts.slice(0, 3);

  return (
    <Layout>
      <section>
        <h1>Tuning Digital</h1>
        <p>
          Guides and checklists to tune your websites, tools, and workflows for better performance, revenue, and
          reliability.
        </p>
      </section>

      <section>
        <h2>Latest guides</h2>
        <ul>
          {latest.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/blog">View all articles →</Link>
        </p>
      </section>
    </Layout>
  );
}

export async function getStaticProps() {
  const posts = getAllPosts();
  return { props: { posts } };
}
