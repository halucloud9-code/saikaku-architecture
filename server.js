import app from './api/_app.js';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ ローカルAPIサーバー起動: http://localhost:${PORT}`);
});
