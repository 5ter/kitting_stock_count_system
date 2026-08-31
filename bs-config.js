module.exports ={
  proxy: "localhost:3000",
  port: 3001,
  files: ["public/**/*", "views/**/*"], // real array, no comma-string parsing involved
  reloadDelay: 300,
  ui: { port: 3002 }
}