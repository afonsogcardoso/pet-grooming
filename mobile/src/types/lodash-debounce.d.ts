declare module 'lodash.debounce' {
  function debounce<T extends (...args: any[]) => any>(fn: T, wait?: number, options?: any): T & { cancel: () => void; flush?: () => void };
  export default debounce;
}
