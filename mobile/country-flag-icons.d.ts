// The package types only its index; importing one flag by path keeps the other ~270 out of the bundle.
declare module 'country-flag-icons/string/3x2/*' {
  const svg: string;
  export default svg;
}
