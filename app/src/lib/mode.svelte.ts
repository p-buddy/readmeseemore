const query = matchMedia('(prefers-color-scheme: dark)');

const get = () => query.matches;

let isDark = $state(get());

query.addEventListener('change', () => isDark = get());

export default {
  get isDark() {
    return isDark;
  },
};
