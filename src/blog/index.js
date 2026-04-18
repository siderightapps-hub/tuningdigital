import Link from 'next/link';
import Layout from 'components/Layout';
import { getAllPosts } from 'lib/posts';

export default function BlogIndex({ posts }) {
  return (
    <Layout title="Blog – Tuning Digital" description="Guides on tuning websites, tools, and workflows.">
      <h1>Blog</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <small>{post.date}</small>
            <p>{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </Layout>
  );
}

export async function getStaticProps() {
  const posts = getAllPosts();
  return { props: { posts } };
}
