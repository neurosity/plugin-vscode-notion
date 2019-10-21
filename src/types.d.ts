declare module "frappe-charts" {
  export const Chart: any;
}
declare module "@sindresorhus/do-not-disturb" {
  export function enable(): Promise<void>;
  export function disable(): Promise<void>;
}
declare module "datadog-metrics" {
  export const BufferedMetricsLogger: any;
}
