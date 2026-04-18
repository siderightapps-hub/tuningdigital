import Link from 'next/link';

export default function Header() {
  return (
    <header>
      <h1>
        <Link href="/">Tuning Digital</Link>
      </h1>
      <nav>
        <Link href="/">Home</Link> | <Link href="/blog">Blog</Link>
      </nav>
    </header>
  );
}
