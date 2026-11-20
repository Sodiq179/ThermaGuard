import type { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}

export function Card({ children, className, as: Tag = "section" }: CardProps) {
  return <Tag className={clsx("card", className)}>{children}</Tag>;
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3.5 pb-2", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <h2 className="h-title">{title}</h2>
        {subtitle && <span className="truncate text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}
