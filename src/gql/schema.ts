import { gql } from 'apollo-server';

const Query = gql`
  type Query {
    unit(id: String!): Unit
  }

  type Unit {
    id: String!
    title: String
    content: String
  }
`;

const typeDefs = [Query];

export default typeDefs;
