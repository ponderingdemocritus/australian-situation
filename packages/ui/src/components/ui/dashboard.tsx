import * as React from "react";
import { cn } from "../../lib/utils";

type DashboardPanelProps = React.ComponentProps<"section">;

function DashboardPanel({ className, ...props }: DashboardPanelProps) {
  return <section data-slot="dashboard-panel" className={cn("dashboard-panel", className)} {...props} />;
}

type DashboardPanelHeaderProps = React.ComponentProps<"div"> & {
  title: string;
  channel?: string;
  titleClassName?: string;
  channelClassName?: string;
};

function DashboardPanelHeader({
  className,
  title,
  channel,
  titleClassName,
  channelClassName,
  ...props
}: DashboardPanelHeaderProps) {
  return (
    <div data-slot="dashboard-panel-header" className={cn("dashboard-panel-header", className)} {...props}>
      <span className={cn("dashboard-panel-title", titleClassName)}>{title}</span>
      {channel ? <span className={cn("dashboard-panel-channel", channelClassName)}>{channel}</span> : null}
    </div>
  );
}

type StatusIndicatorProps = React.ComponentProps<"div"> & {
  alert?: boolean;
  label: string;
};

function StatusIndicator({ className, alert = false, label, ...props }: StatusIndicatorProps) {
  return (
    <div data-slot="status-indicator" className={cn("status-indicator", className)} {...props}>
      <span aria-hidden className={cn("status-dot", alert && "status-dot-alert")} />
      <span>{label}</span>
    </div>
  );
}

type DashboardMetricProps = React.ComponentProps<"div"> & {
  delta: string;
  label: string;
  value: string;
  deltaNegative?: boolean;
  valueAlert?: boolean;
};

function DashboardMetric({
  className,
  delta,
  label,
  value,
  deltaNegative = false,
  valueAlert = false,
  ...props
}: DashboardMetricProps) {
  return (
    <div data-slot="dashboard-metric" className={cn("dashboard-metric-item", className)} {...props}>
      <div className="dashboard-metric-label">{label}</div>
      <div className={cn("dashboard-metric-value", valueAlert && "dashboard-metric-value-alert")}>{value}</div>
      <div className={cn("dashboard-metric-delta", deltaNegative && "dashboard-metric-delta-negative")}>{delta}</div>
    </div>
  );
}

type DashboardAlertItemProps = React.ComponentProps<"div">;

function DashboardAlertItem({ className, ...props }: DashboardAlertItemProps) {
  return <div data-slot="dashboard-alert-item" className={cn("dashboard-alert-item", className)} {...props} />;
}

type DashboardNodeRowProps = React.ComponentProps<"div"> & {
  nodeId: string;
  offline?: boolean;
  status: string;
};

function DashboardNodeRow({ className, nodeId, offline = false, status, ...props }: DashboardNodeRowProps) {
  return (
    <div data-slot="dashboard-node-row" className={cn("dashboard-node-row", className)} {...props}>
      <span className="dashboard-node-id">{nodeId}</span>
      <span className={cn("dashboard-node-status", offline && "dashboard-node-status-offline")}>{status}</span>
    </div>
  );
}

export {
  DashboardAlertItem,
  DashboardMetric,
  DashboardNodeRow,
  DashboardPanel,
  DashboardPanelHeader,
  StatusIndicator
};
