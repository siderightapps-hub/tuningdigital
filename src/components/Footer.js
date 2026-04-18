export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <p>© {year} Tuning Digital. Optimising websites, tools, and workflows.</p>
    </footer>
  );
}
