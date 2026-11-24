/**
 * Approximate coordinates of major Indian cities, by location slug. Used to place pins on the city-page map when a
 * location has no latitude/longitude saved (Admin › City pages › Geo locations); saved coordinates always win.
 */
export const CITY_COORDS: Record<string, [number, number]> = {
  mumbai: [19.08, 72.88], "navi-mumbai": [19.03, 73.03], thane: [19.22, 72.98], pune: [18.52, 73.86],
  "new-delhi": [28.61, 77.21], delhi: [28.66, 77.23], gurugram: [28.46, 77.03], gurgaon: [28.46, 77.03], noida: [28.54, 77.39],
  faridabad: [28.41, 77.32], ghaziabad: [28.67, 77.45], bengaluru: [12.97, 77.59], bangalore: [12.97, 77.59],
  hyderabad: [17.39, 78.49], chennai: [13.08, 80.27], kolkata: [22.57, 88.36], ahmedabad: [23.02, 72.57],
  surat: [21.17, 72.83], vadodara: [22.31, 73.18], rajkot: [22.3, 70.8], jaipur: [26.91, 75.79], lucknow: [26.85, 80.95],
  kanpur: [26.45, 80.33], chandigarh: [30.73, 76.78], mohali: [30.7, 76.72], ludhiana: [30.9, 75.86], amritsar: [31.63, 74.87],
  indore: [22.72, 75.86], bhopal: [23.26, 77.41], nagpur: [21.15, 79.09], nashik: [19.99, 73.79], aurangabad: [19.88, 75.34],
  kochi: [9.93, 76.27], thiruvananthapuram: [8.52, 76.94], coimbatore: [11.02, 76.96], madurai: [9.93, 78.12],
  mysuru: [12.3, 76.64], mangaluru: [12.91, 74.86], visakhapatnam: [17.69, 83.22], vijayawada: [16.51, 80.65],
  bhubaneswar: [20.3, 85.82], patna: [25.59, 85.14], ranchi: [23.34, 85.31], guwahati: [26.14, 91.74], dehradun: [30.32, 78.03],
  goa: [15.5, 73.83], panaji: [15.5, 73.83], raipur: [21.25, 81.63], jodhpur: [26.24, 73.02], udaipur: [24.58, 73.71],
  varanasi: [25.32, 82.97], agra: [27.18, 78.01], srinagar: [34.08, 74.8], jammu: [32.73, 74.86], shimla: [31.1, 77.17],
};
