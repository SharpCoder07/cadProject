/**
 * Indian cities offered by the City field on website forms (when the field has no list of its own in
 * Admin › Pages › Forms). Name and state; the state is shown and searchable but only the name is saved.
 */
const DATA = `Agartala|Tripura
Agra|Uttar Pradesh
Ahmedabad|Gujarat
Ahmednagar|Maharashtra
Aizawl|Mizoram
Ajmer|Rajasthan
Akola|Maharashtra
Alappuzha|Kerala
Aligarh|Uttar Pradesh
Alwar|Rajasthan
Ambala|Haryana
Amravati|Maharashtra
Amritsar|Punjab
Anand|Gujarat
Anantapur|Andhra Pradesh
Asansol|West Bengal
Aurangabad|Maharashtra
Bareilly|Uttar Pradesh
Belagavi|Karnataka
Bengaluru|Karnataka
Bhagalpur|Bihar
Bharuch|Gujarat
Bhavnagar|Gujarat
Bhilai|Chhattisgarh
Bhiwadi|Rajasthan
Bhopal|Madhya Pradesh
Bhubaneswar|Odisha
Bikaner|Rajasthan
Bilaspur|Chhattisgarh
Bokaro|Jharkhand
Chandigarh|Chandigarh
Chennai|Tamil Nadu
Coimbatore|Tamil Nadu
Cuttack|Odisha
Darbhanga|Bihar
Davanagere|Karnataka
Dehradun|Uttarakhand
Delhi|Delhi
Dhanbad|Jharkhand
Dharwad|Karnataka
Durg|Chhattisgarh
Durgapur|West Bengal
Erode|Tamil Nadu
Faridabad|Haryana
Gandhinagar|Gujarat
Gangtok|Sikkim
Gaya|Bihar
Ghaziabad|Uttar Pradesh
Goa|Goa
Gorakhpur|Uttar Pradesh
Greater Noida|Uttar Pradesh
Gulbarga|Karnataka
Guntur|Andhra Pradesh
Gurugram|Haryana
Guwahati|Assam
Gwalior|Madhya Pradesh
Haldwani|Uttarakhand
Haridwar|Uttarakhand
Hisar|Haryana
Hosur|Tamil Nadu
Howrah|West Bengal
Hubballi|Karnataka
Hyderabad|Telangana
Imphal|Manipur
Indore|Madhya Pradesh
Itanagar|Arunachal Pradesh
Jabalpur|Madhya Pradesh
Jaipur|Rajasthan
Jalandhar|Punjab
Jalgaon|Maharashtra
Jammu|Jammu and Kashmir
Jamnagar|Gujarat
Jamshedpur|Jharkhand
Jhansi|Uttar Pradesh
Jodhpur|Rajasthan
Junagadh|Gujarat
Kakinada|Andhra Pradesh
Kalyan|Maharashtra
Kannur|Kerala
Kanpur|Uttar Pradesh
Karnal|Haryana
Kochi|Kerala
Kolhapur|Maharashtra
Kolkata|West Bengal
Kollam|Kerala
Kota|Rajasthan
Kozhikode|Kerala
Kurnool|Andhra Pradesh
Lucknow|Uttar Pradesh
Ludhiana|Punjab
Madurai|Tamil Nadu
Mangaluru|Karnataka
Mathura|Uttar Pradesh
Meerut|Uttar Pradesh
Mohali|Punjab
Moradabad|Uttar Pradesh
Mumbai|Maharashtra
Muzaffarpur|Bihar
Mysuru|Karnataka
Nagpur|Maharashtra
Nashik|Maharashtra
Navi Mumbai|Maharashtra
Nellore|Andhra Pradesh
Noida|Uttar Pradesh
Panaji|Goa
Panipat|Haryana
Patiala|Punjab
Patna|Bihar
Puducherry|Puducherry
Pune|Maharashtra
Raipur|Chhattisgarh
Rajahmundry|Andhra Pradesh
Rajkot|Gujarat
Ranchi|Jharkhand
Rohtak|Haryana
Rourkela|Odisha
Saharanpur|Uttar Pradesh
Salem|Tamil Nadu
Sangli|Maharashtra
Shillong|Meghalaya
Shimla|Himachal Pradesh
Siliguri|West Bengal
Solapur|Maharashtra
Sonipat|Haryana
Srinagar|Jammu and Kashmir
Surat|Gujarat
Thane|Maharashtra
Thanjavur|Tamil Nadu
Thiruvananthapuram|Kerala
Thrissur|Kerala
Tiruchirappalli|Tamil Nadu
Tirunelveli|Tamil Nadu
Tirupati|Andhra Pradesh
Tiruppur|Tamil Nadu
Udaipur|Rajasthan
Ujjain|Madhya Pradesh
Vadodara|Gujarat
Vapi|Gujarat
Varanasi|Uttar Pradesh
Vellore|Tamil Nadu
Vijayawada|Andhra Pradesh
Visakhapatnam|Andhra Pradesh
Warangal|Telangana
Zirakpur|Punjab`;

export interface City { name: string; state: string }

export const INDIAN_CITIES: City[] = DATA.split("\n").map((l) => {
  const [name, state] = l.split("|") as [string, string];
  return { name, state };
});

/** Several cities are saved as one answer, separated by commas. */
export const splitCities = (v: string) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))];
