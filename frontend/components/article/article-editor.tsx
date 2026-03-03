import React from "react"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { ArticleVersion } from "@/lib/article-types"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from "@/components/ui/button"
import { Eye, Edit } from "lucide-react"
import { useState } from "react"
import type { Components } from 'react-markdown'
import { PrismaFlowDiagram } from "@/components/screening/prisma-flow-diagram"

/* ── Estilo académico global (Times New Roman / serif) ── */
const serifFont = "'Times New Roman', 'Noto Serif', Georgia, serif"

// Componentes de Markdown — diseño académico tipo journal
const MarkdownImage = ({ node, ...props }: any) => {
  const [error, setError] = React.useState(false)
  const captionText = props.alt || ''

  return (
    <figure className="my-6 text-center">
      {error ? (
        <div className="inline-flex flex-col items-center justify-center gap-2 max-w-[90%] mx-auto p-4 border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded text-amber-700 dark:text-amber-400 text-sm">
          <span>⚠️ Imagen no disponible</span>
          {captionText && <span className="text-xs opacity-75">{captionText}</span>}
          <span className="text-xs opacity-50 italic break-all">{props.src}</span>
        </div>
      ) : (
        <img
          {...props}
          alt={captionText}
          className="max-w-[90%] h-auto mx-auto border border-border rounded shadow-sm"
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
      {captionText && !error && (
        <figcaption
          className="mt-2 text-muted-foreground italic text-center"
          style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '10pt' }}
        >
          {captionText}
        </figcaption>
      )}
    </figure>
  )
}

const MarkdownTable = ({ node, ...props }: any) => (
  <div className="overflow-x-auto my-6">
    <table
      {...props}
      className="min-w-full border-collapse border-t-2 border-b-2 border-foreground/50"
      style={{
        fontFamily: serifFont,
        fontSize: '10pt',
      }}
    />
  </div>
)

const MarkdownTableHead = ({ node, ...props }: any) => (
  <thead {...props} className="border-b border-foreground/50" />
)

const MarkdownTableHeader = ({ node, ...props }: any) => (
  <th
    {...props}
    scope="col"
    className="px-3 py-1.5 font-bold text-left text-foreground"
    style={{ fontFamily: serifFont, fontSize: '10pt' }}
  />
)

const MarkdownTableCell = ({ node, ...props }: any) => (
  <td
    {...props}
    className="px-3 py-1.5 text-foreground"
    style={{ fontFamily: serifFont, fontSize: '10pt' }}
  />
)

const MarkdownTableRow = ({ node, ...props }: any) => {
  // Determine if this is inside <tbody> to apply alternating row shading
  const isBody = !(props.children && Array.isArray(props.children) && props.children.some?.((c: any) => c?.type === MarkdownTableHeader))
  return (
    <tr
      {...props}
      style={isBody ? { backgroundColor: undefined } : undefined}
      className={isBody ? "even:bg-muted/50" : ""}
    />
  )
}

const MarkdownHeading2 = ({ node, ...props }: any) => (
  <h2
    {...props}
    className="text-base font-bold mt-6 mb-2 text-foreground"
    style={{ fontFamily: serifFont, fontSize: '13pt' }}
  />
)

const MarkdownHeading3 = ({ node, ...props }: any) => (
  <h3
    {...props}
    className="text-sm font-bold mt-4 mb-1.5 text-foreground"
    style={{ fontFamily: serifFont, fontSize: '12pt', fontStyle: 'italic' }}
  />
)

const MarkdownHeading4 = ({ node, ...props }: any) => (
  <h4
    {...props}
    className="text-sm font-semibold mt-3 mb-1 text-foreground"
    style={{ fontFamily: serifFont, fontSize: '11pt' }}
  />
)

const MarkdownParagraph = ({ node, children, ...props }: any) => {
  // If paragraph contains an image, render as div to avoid <figure> inside <p> hydration error
  const hasImage = node?.children?.some((child: any) =>
    child.type === 'element' && child.tagName === 'img'
  )
  if (hasImage) {
    return <div className="mb-2 text-foreground" style={{ fontFamily: serifFont, fontSize: '12pt', lineHeight: '1.6', textAlign: 'justify' }}>{children}</div>
  }
  return (
    <p
      {...props}
      className="mb-2 text-foreground"
      style={{
        fontFamily: serifFont,
        fontSize: '12pt',
        lineHeight: '1.6',
        textAlign: 'justify',
        textIndent: '1.5em',
      }}
    >{children}</p>
  )
}

const MarkdownListItem = ({ node, ...props }: any) => (
  <li
    {...props}
    className="mb-1 text-foreground"
    style={{ fontFamily: serifFont, fontSize: '11pt', lineHeight: '1.5' }}
  />
)

const MarkdownEmphasis = ({ node, ...props }: any) => (
  <em {...props} style={{ fontFamily: serifFont }} />
)

const MarkdownStrong = ({ node, ...props }: any) => (
  <strong {...props} style={{ fontFamily: serifFont }} />
)

const markdownComponents: Components = {
  img: MarkdownImage,
  table: MarkdownTable,
  thead: MarkdownTableHead,
  th: MarkdownTableHeader,
  td: MarkdownTableCell,
  tr: MarkdownTableRow,
  h2: MarkdownHeading2,
  h3: MarkdownHeading3,
  h4: MarkdownHeading4,
  p: MarkdownParagraph,
  li: MarkdownListItem,
  em: MarkdownEmphasis,
  strong: MarkdownStrong,
}

interface ArticleEditorProps {
  version: ArticleVersion
  onContentChange: (section: keyof ArticleVersion["content"], content: string) => void
  disabled?: boolean
  prismaStats?: any
}

export function ArticleEditor({ version, onContentChange, disabled = false, prismaStats }: ArticleEditorProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null)

  // Markdown components for Results section: replaces PRISMA chart images with React component
  const resultsMarkdownComponents: Components = {
    ...markdownComponents,
    // Fix HTML nesting: check AST node before transformation
    p: ({ node, children, ...props }: any) => {
      // Check AST node for img child with PRISMA alt text
      const hasPrismaImg = node?.children?.some((child: any) =>
        child.type === 'element' &&
        child.tagName === 'img' &&
        child.properties?.alt?.toLowerCase().includes('prisma')
      )

      if (hasPrismaImg && prismaStats) {
        return (
          <div className="my-6">
            <PrismaFlowDiagram stats={prismaStats} />
          </div>
        )
      }

      return <MarkdownParagraph node={node} {...props}>{children}</MarkdownParagraph>
    },
    img: ({ node, ...props }: any) => {
      // Skip rendering if it's a PRISMA image (handled by p component above)
      if (prismaStats && props.alt?.toLowerCase().includes('prisma')) {
        return null
      }
      return <MarkdownImage node={node} {...props} />
    }
  }

  const sections = [
    { key: "abstract" as const, label: "Resumen", rows: 6 },
    { key: "introduction" as const, label: "Introducción", rows: 10 },
    { key: "methods" as const, label: "Métodos", rows: 10 },
    { key: "results" as const, label: "Resultados", rows: 10 },
    { key: "discussion" as const, label: "Discusión", rows: 10 },
    { key: "conclusions" as const, label: "Conclusiones", rows: 6 },
    { key: "references" as const, label: "Referencias", rows: 8 },
    { key: "declarations" as const, label: "Declaraciones", rows: 8 },
  ]

  return (
    <Card className="w-full shadow-sm">
      <ScrollArea className="h-[calc(100vh-180px)] p-6">
        <div className="max-w-5xl mx-auto space-y-4 pb-12 px-12" style={{ fontFamily: serifFont }}>
          {/* Document Header — estilo académico */}
          <div id="section-title" className="text-center border-b-2 border-border pb-4 mb-6 scroll-mt-6">
            <h1
              className="font-bold tracking-tight mb-2 text-foreground"
              style={{ fontFamily: serifFont, fontSize: '16pt', lineHeight: '1.3' }}
            >
              {version.title}
            </h1>
            <p className="text-muted-foreground" style={{ fontFamily: serifFont, fontSize: '10pt' }}>
              Versión {version.version} • {new Date(version.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {sections.map((section) => (
            <div
              key={section.key}
              id={`section-${section.key}`}
              className="scroll-mt-6 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={section.key}
                  className="font-bold text-primary uppercase tracking-wide"
                  style={{ fontFamily: serifFont, fontSize: '13pt' }}
                >
                  {section.label}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full" style={{ fontFamily: 'sans-serif' }}>
                    {(version.content[section.key] || '').split(/\s+/).filter(w => w.length > 0).length} palabras
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setEditingSection(editingSection === section.key ? null : section.key)}
                  >
                    {editingSection === section.key ? (
                      <><Eye className="h-3 w-3 mr-1" /> Vista Previa</>
                    ) : (
                      <><Edit className="h-3 w-3 mr-1" /> Editar</>
                    )}
                  </Button>
                </div>
              </div>

              {editingSection === section.key ? (
                <Textarea
                  id={section.key}
                  value={version.content[section.key] || ''}
                  onChange={(e) => onContentChange(section.key, e.target.value)}
                  className="min-h-[120px] font-mono text-xs leading-relaxed border border-muted focus-visible:ring-1 focus-visible:ring-primary px-3 py-2 resize-y bg-muted/20"
                  placeholder={`Escribe o genera el contenido para ${section.label.toLowerCase()}...`}
                  disabled={disabled}
                  style={{ minHeight: `${section.rows * 1.3}em` }}
                />
              ) : (
                <div className="max-w-none min-h-[60px] p-4 rounded-sm border border-border hover:border-muted-foreground/30 transition-colors" style={{ fontFamily: serifFont }}>
                  {version.content[section.key] ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={section.key === 'results' ? resultsMarkdownComponents : markdownComponents}
                    >
                      {version.content[section.key]}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic" style={{ fontFamily: serifFont, fontSize: '11pt' }}>
                      Haz clic en "Editar" para agregar contenido o usa "Generar Borrador Completo"
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
