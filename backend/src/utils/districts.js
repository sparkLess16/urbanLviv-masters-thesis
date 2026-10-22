// Single source of truth for Lviv districts.
export const DISTRICTS = [
  { id: "halytskyi", name: "🏛 Halytskyi", ukName: "Галицький" },
  { id: "frankivskyi", name: "🌳 Frankivskyi", ukName: "Франківський" },
  { id: "lychakivskyi", name: "⛪ Lychakivskyi", ukName: "Личаківський" },
  { id: "sykhivskyi", name: "🏙 Sykhivskyi", ukName: "Сихівський" },
  {
    id: "shevchenkivskyi",
    name: "📚 Shevchenkivskyi",
    ukName: "Шевченківський",
  },
  { id: "zaliznychnyi", name: "🚉 Zaliznychnyi", ukName: "Залізничний" },
];

export const getDistrictLabel = (id) =>
  DISTRICTS.find((district) => district.id === id)?.name ?? id;
