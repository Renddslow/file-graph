import { TYPENAMES, getSourceFile, writeSourceFile } from '../utils';
import kebabCase from 'lodash.kebabcase';

export const resolvers = {
  Query: {
    /**
     * Return an array of String representing the unit ID's for a given Course
     * @param parent
     * @param args - args.courseId is required
     * @param ctx
     */
    listUnits: async (parent, args, ctx): Promise<string[]> => {
      const courseFile = await getSourceFile(args.courseId, ctx, TYPENAMES.COURSE);
      return courseFile && courseFile.units ? courseFile.units.map((unit) => unit.id) : null;
    },
  },
  Unit: {
    pages: async (parent, args, ctx) => {
      //console.log([parent, args, ctx]);
      return await parent.pages?.map(async (page) => {
        return await getSourceFile(page, ctx, TYPENAMES.PAGE);
      });
    },
  },
  Mutation: {
    saveUnit: async (parent, args, ctx) => {
      try {
        const { title, courseId, unitOrder } = args.input;
        const courseFile = await getSourceFile(courseId, ctx, TYPENAMES.COURSE);
        if (!courseFile) {
          console.debug(`Saving a unit in course ${courseId}`, ctx.schema[courseId]);
          throw new Error(`${courseId} not found`);
        }

        const id = args.input.id || kebabCase(title);
        const unitIndex = courseFile.units ? courseFile.units.findIndex((u) => u.id === id) : -1;
        let pageList = args.input.pages ? args.input.pages.map((p): string[] => p.id) : null;
        //if no page list was passed in and this is an existing unit, get the page list from that existing unit
        if (!pageList && unitIndex > -1) {
          pageList = courseFile.units[unitIndex].pages;
        }
        const saveUnit = {
          id,
          title,
          type: TYPENAMES.UNIT,
          pages: [],
        };
        if (pageList) {
          saveUnit.pages = pageList;
        } else {
          delete saveUnit.pages;
        }

        //if the unit is found, remove it.
        if (unitIndex > -1) {
          courseFile.units.splice(unitIndex, 1);
        }
        //and add the new unit
        courseFile.units.splice(unitOrder, 0, saveUnit);
        console.debug(`Writing course ${courseId} to file`, courseFile);
        await writeSourceFile(ctx, courseId, TYPENAMES.COURSE, courseFile, null, null);

        //generate return object
        const returnUnit = {
          id,
          title,
          pages: [],
        };
        if (saveUnit.pages) {
          returnUnit.pages = saveUnit.pages.map(async (p) => {
            return await getSourceFile(p, ctx, TYPENAMES.PAGE);
          });
        }
        return returnUnit;
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    deleteUnit: async (parent, args, ctx) => {
      const { unitId, courseId } = args;
      try {
        const courseFile = await getSourceFile(courseId, ctx, TYPENAMES.COURSE);
        if (!courseFile) {
          throw new Error(`${courseId} not found`);
        }

        const i = courseFile.units.findIndex((u) => u.id === unitId);
        if (i > -1) {
          courseFile.units.splice(i, 1);
          await writeSourceFile(ctx, courseId, TYPENAMES.COURSE, courseFile, null, null);
          return true;
        }
      } catch (e) {
        console.error(e);
      }
      return false;
    },
  },
};
