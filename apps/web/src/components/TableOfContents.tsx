interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Table of contents" className="toc">
      <p className="toc__title">On this page</p>
      <ul className="toc__list">
        {items.map((item) => (
          <li key={item.id} className={`toc__item toc__item--l${item.level}`}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
