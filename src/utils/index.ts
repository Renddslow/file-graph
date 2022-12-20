import matter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';

export const TYPENAMES = {
  COURSE: 'course',
  UNIT: 'unit',
  PAGE: 'page',
};

/**
 * Generates a JS object based on a YAML or MDX file using gray-matter
 * @param id - identifier in the schema of the file (the ID)
 * @param ctx - access to the server context, specifically the schema
 * @returns JS object containing the metadata and content of the retrieved file
 */
export const getSourceFile = async (id: string, ctx: any, typename: string): Promise<any> => {
  if (!ctx.schema[id] || ctx.schema[id].typename !== typename) {
    return null;
  }
  const filepath = ctx.schema[id].filepath;
  //console.debug(filepath);
  const file = await fs.readFile(path.join(process.cwd(), filepath), 'utf8');
  const { data, content } = matter(file);

  return { ...data, content: content.trim() };
};

export const writeSourceFile = async (
  ctx: any,
  id: string,
  filetype: string,
  frontMatter: object,
  content: string,
  parentId: string,
): Promise<void> => {
  let filepath;
  if (filetype === TYPENAMES.COURSE) {
    filepath = `content/${id}/course.yaml`;
  } else {
    filepath = `content/${parentId}/pages/${id}.mdx`;
  }
  const output = matter.stringify(content ? content : '', frontMatter);
  await fs.writeFile(path.join(process.cwd(), filepath), output);
  ctx.schema[id] = {
    typename: filetype,
    filepath,
  };
};

export const setupCourseDirs = async (id: string): Promise<void> => {
  const courseDirPath = path.join(process.cwd(), `content/${id}`);
  await fs.mkdir(courseDirPath);
  const pagesDirPath = path.join(process.cwd(), `content/${id}/pages`);
  await fs.mkdir(pagesDirPath);
};

export const hasValidPageFields = (p: any): boolean => {
  return (
    p.id !== undefined &&
    p.title !== undefined &&
    p.content !== undefined &&
    p.pageOrder !== undefined
  );
};
