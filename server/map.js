// PG row (snake_case; numerics arrive as strings) -> the Metro shape the app
// already consumes. Absent optional fields are omitted, not set to null.
const num = (v) => (v == null ? undefined : Number(v));

export function mapMetro(row) {
  const m = {
    id: row.id,
    name: row.name,
    short: row.short,
    states: row.states,
    rpp: {
      overall: num(row.rpp_overall),
      housing: num(row.rpp_housing),
      goods: num(row.rpp_goods),
      otherServices: num(row.rpp_other_services),
    },
  };
  if (row.pop != null) m.pop = row.pop;
  if (row.politics != null) m.politics = num(row.politics);
  if (row.temp_f != null) m.tempF = num(row.temp_f);
  if (row.humidity != null) m.humidity = num(row.humidity);
  if (row.aqi != null) m.aqi = num(row.aqi);
  if (row.risk != null) m.risk = num(row.risk);
  if (row.cbsa != null) m.cbsa = row.cbsa;
  if (row.wikipedia_url != null) m.wikipedia_url = row.wikipedia_url;
  if (row.blurb != null) m.blurb = row.blurb;
  return m;
}
