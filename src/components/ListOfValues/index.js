import React from 'react';
import {
  Typography,
  Row,
  Divider,
} from 'antd';

import './index.scss';

const { Text } = Typography;

export default ({ data }) =>
  data.map((item, index) => (
    <Row key={index}>
      {index > 0 && <Divider className="divider" />}
      <Row type="flex" justify="space-between">
        <Text>{item.text}</Text>
        <Text>{item.value}</Text>
      </Row>
    </Row>
  ));
