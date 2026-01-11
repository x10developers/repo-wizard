import express from "express";

const router = express.Router();

router.get("/login", (req, res) => {
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${process.env.GITHUB_CLIENT_ID}` +
    `&scope=read:org`;

  res.redirect(url);
});

export default router;
