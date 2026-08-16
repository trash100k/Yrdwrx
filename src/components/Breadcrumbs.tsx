import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Crumb {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  crumbs: Crumb[];
}

export function Breadcrumbs({ crumbs }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-zinc-500">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight size={14} className="text-zinc-600" aria-hidden="true" />}
            {isLast || !crumb.path ? (
              <span
                className={`font-semibold ${isLast ? 'text-zinc-200' : ''}`}
                {...(isLast ? { "aria-current": "page" } : {})}
              >
                {crumb.label}
              </span>
            ) : (
              <Link 
                to={crumb.path} 
                className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-forest-500 focus:outline-none rounded-sm"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
