const ts = require('typescript')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../src')
const entries = new Map()
const attrs = new Set(['title','label','caption','reason','placeholder','aria-label','disabledReason','note','subtitle','lede','word','detail','short','desc','heading','infoLabel'])
function add(value, file) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!/[A-Za-z]{2}/.test(text) || /[\u3400-\u9fff]/.test(text)) return
  if (!entries.has(text)) entries.set(text, new Set())
  entries.get(text).add(path.relative(root, file).replaceAll('\\','/'))
}
function scan(file) {
  const source = fs.readFileSync(file,'utf8')
  const sf = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  function walk(n, protectedText = false) {
    if (ts.isJsxElement(n)) {
      const tag=n.openingElement.tagName.getText(sf)
      protectedText ||= ['pre','code','script','style'].includes(tag) || n.openingElement.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)==='translate'&&a.initializer&&ts.isStringLiteral(a.initializer)&&a.initializer.text==='no')
    }
    if (!protectedText && ts.isJsxText(n)) add(n.text,file)
    if (ts.isJsxAttribute(n) && attrs.has(n.name.getText(sf)) && n.initializer && ts.isStringLiteral(n.initializer)) add(n.initializer.text,file)
    if (!protectedText && ts.isJsxExpression(n) && n.expression && (!ts.isJsxAttribute(n.parent) || attrs.has(n.parent.name.getText(sf)))) {
      const visitExpr=e=>{
        if (ts.isStringLiteral(e)||ts.isNoSubstitutionTemplateLiteral(e)) add(e.text,file)
        if (ts.isTemplateExpression(e)) add(e.head.text+e.templateSpans.map((s,i)=>`{${i}}`+s.literal.text).join(''),file)
        if (ts.isConditionalExpression(e)) {visitExpr(e.whenTrue);visitExpr(e.whenFalse)}
        if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {visitExpr(e.left);visitExpr(e.right)}
        if (ts.isBinaryExpression(e)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) visitExpr(e.right)
      }
      visitExpr(n.expression)
    }
    ts.forEachChild(n,c=>walk(c,protectedText))
  }
  walk(sf)
}
function dir(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())dir(p);else if(p.endsWith('.tsx'))scan(p)}}
dir(root)
const list=[...entries].map(([text,files])=>({text,files:[...files]})).sort((a,b)=>a.text.localeCompare(b.text))
fs.mkdirSync(path.resolve(__dirname,'../../.tmp'),{recursive:true})
fs.writeFileSync(path.resolve(__dirname,'../../.tmp/ui-inventory.json'),JSON.stringify(list,null,2))
console.log(JSON.stringify({strings:list.length,files:new Set(list.flatMap(e=>e.files)).size}))
if (process.argv.includes('--check') && list.length) {
  console.error(list.map(entry => entry.files.join(', ') + ': ' + entry.text).join('\n'))
  process.exitCode = 1
}
