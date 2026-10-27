import { PanelShell } from "@/components/panel/panel-shell";

export default function ShellLayout({ children }: LayoutProps<"/panel">) {
  return <PanelShell>{children}</PanelShell>;
}
