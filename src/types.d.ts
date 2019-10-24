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
declare module "osx-brightness" {
  export function get(): Promise<void>;
  export function set(value: number): Promise<void>;
}
