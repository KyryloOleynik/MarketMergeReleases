const EU_TO_US_MEN={'35.5':'3.5','36':'4','36.5':'4.5','37.5':'5','38':'5.5','38.5':'6','39':'6.5','40':'7','40.5':'7.5','41':'8','42':'8.5','42.5':'9','43':'9.5','44':'10','44.5':'10.5','45':'11','45.5':'11.5','46':'12','47':'12.5','47.5':'13','48':'13.5','48.5':'14','49':'14.5','49.5':'15','50':'15.5','50.5':'16'};  
const EU_TO_US_WOMEN={'33.5':'3.5','34.5':'4','35':'4.5','35.5':'5','36':'5.5','36.5':'6','37.5':'6.5','38':'7','38.5':'7.5','39':'8','40':'8.5','40.5':'9','41':'9.5','42':'10','42.5':'10.5','43':'11','44':'11.5','44.5':'12','45.5':'12.5','46':'13','47':'13.5','47.5':'14','48.5':'14.5'};

const findId = (map, value) => { 
  if (!value) return null;
  value = String(value).trim();
  if (map.hasOwnProperty(value)) return map[value];
  const dot = value.replace(',', '.');
  const comma = value.replace('.', ',');
  if (map.hasOwnProperty(dot)) return map[dot];
  if (map.hasOwnProperty(comma)) return map[comma];
  const num = Number(dot);
  if (!Number.isNaN(num)) {
    const numStr = Number.isInteger(num) ? String(parseInt(num, 10)) : String(num);
    if (map.hasOwnProperty(numStr)) return map[numStr];

    const keys = Object.keys(map)
      .map(k => ({ key: k, num: Number(String(k).replace(',', '.')) }))
      .filter(k => !Number.isNaN(k.num));

    if (keys.length > 0) {
      let closest = keys[0];
      let minDiff = Math.abs(num - keys[0].num);
      for (let i = 1; i < keys.length; i++) {
        const diff = Math.abs(num - keys[i].num);
        if (diff < minDiff) {
          minDiff = diff;
          closest = keys[i];
        }
      }
      return map[closest.key];
    }
  }
  return null;
};

const convertEUtoUS = (value, gender) => {
  if (!value) return null;
  const cleanValue = String(value).trim().replace(',', '.');
  if (gender === 'women' && EU_TO_US_WOMEN[cleanValue]) return EU_TO_US_WOMEN[cleanValue];
  if (gender === 'men' && EU_TO_US_MEN[cleanValue]) return EU_TO_US_MEN[cleanValue];
  const num = Number(cleanValue);
  if (!Number.isNaN(num)) {
    const numStr = Number.isInteger(num) ? String(parseInt(num, 10)) : String(num);
    if (gender === 'women' && EU_TO_US_WOMEN[numStr]) return EU_TO_US_WOMEN[numStr];
    if (gender === 'men' && EU_TO_US_MEN[numStr]) return EU_TO_US_MEN[numStr];
  }
  return null;
};

export { convertEUtoUS, findId };