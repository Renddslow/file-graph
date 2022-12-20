import { gql } from 'apollo-server';

const Query = gql`
  type Query {
    page(id: String!): Page
    course(id: String!): Course
    listCourses: [String]
    listUnits(courseId: String!): [String]
  }

  type Mutation {
    savePage(input: PageInput!): Page!
    deletePage(pageId: String!, unitId: String, courseId: String!): Boolean!
    saveUnit(input: UnitInput!): Unit!
    deleteUnit(unitId: String!, courseId: String!): Boolean!
    saveCourse(input: CourseInput!): Course!
  }

  input PageInput {
    id: String
    title: String!
    content: String!
    pageOrder: Int!
    unitId: String
    courseId: String
  }

  input UnitInput {
    id: String
    title: String!
    unitOrder: Int!
    pages: [PageInput]
    courseId: String
  }

  input CourseInput {
    id: String
    title: String!
    version: String
    subtitle: String
    author: String
    units: [UnitInput]
  }

  type Page {
    id: String!
    title: String
    content: String
  }

  type Unit {
    id: String!
    title: String!
    pages: [Page]
  }

  type Course {
    id: String!
    title: String
    units: [Unit]
  }
`;

const typeDefs = [Query];

export default typeDefs;
